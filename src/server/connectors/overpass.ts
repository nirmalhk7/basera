import { bboxMatchesGeometry, isAreaGeometry, isFinitePosition, isValidBbox, positionsAndSegmentsStrictlyInside, type Bbox, type Position } from "@/server/geo";
import { readJsonWithByteLimit } from "@/server/http";
import type { AreaSelection, LayerId, ResearchFeature, ResearchGeometry } from "@/types/research";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 15_000;
const MAX_FEATURES = 1_000;
const MAX_NODE_WAY_FEATURES = 900;
const MAX_RELATION_FEATURES = 100;
const MAX_BBOX_WIDTH = 5;
const MAX_BBOX_HEIGHT = 5;
const MAX_CONTENT_LENGTH = 5_000_000;
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 100;
const MAX_CONCURRENT_REQUESTS = 2;

export type CurrentOsmLayerId = Extract<
  LayerId,
  | "transport"
  | "roads"
  | "healthcare"
  | "education"
  | "daily_needs"
  | "emergency"
  | "parks"
  | "recreation"
  | "civic"
  | "utilities"
  | "water"
  | "land_use"
  | "industrial_waste"
>;

const SELECTORS: Record<CurrentOsmLayerId, string[]> = {
  transport: [
    '["public_transport"]',
    '["railway"~"^(station|halt)$"]',
    '["railway"="subway_entrance"]',
    '["highway"="bus_stop"]',
    '["amenity"~"^(ferry_terminal|taxi)$"]',
    '["aeroway"~"^(aerodrome|terminal)$"]',
  ],
  roads: ['["highway"]'],
  healthcare: [
    '["healthcare"]',
    '["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy)$"]',
  ],
  education: ['["amenity"~"^(school|college|university|kindergarten)$"]'],
  daily_needs: [
    '["shop"~"^(supermarket|convenience|department_store|mall)$"]',
    '["amenity"="marketplace"]',
  ],
  emergency: [
    '["amenity"~"^(police|fire_station)$"]',
    '["emergency"="ambulance_station"]',
    '["amenity"="hospital"]["emergency"="yes"]',
  ],
  parks: ['["leisure"~"^(park|garden|playground|dog_park)$"]'],
  recreation: [
    '["leisure"~"^(sports_centre|stadium|swimming_pool|pitch|fitness_centre|golf_course)$"]',
    '["landuse"="recreation_ground"]',
  ],
  civic: ['["amenity"~"^(community_centre|townhall|library|post_office|courthouse)$"]'],
  utilities: [
    '["power"~"^(substation|plant)$"]',
    '["construction:power"~"^(substation|plant)$"]',
    '["man_made"~"^(water_works|water_tower|pumping_station)$"]',
  ],
  water: ['["natural"~"^(water|wetland)$"]', '["waterway"]', '["landuse"="reservoir"]'],
  land_use: ['["landuse"]'],
  industrial_waste: [
    '["landuse"~"^(industrial|landfill)$"]',
    '["amenity"~"^(waste_transfer_station|waste_disposal|waste_dump_site)$"]',
    '["man_made"~"^(works|wastewater_plant)$"]',
  ],
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, unknown>;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  geometry?: unknown;
};

type OverpassPayload = {
  elements: OsmElement[];
  osm3s?: { timestamp_osm_base?: unknown };
};

const cache = new Map<string, { expiresAt: number; value: OverpassLayerQuery }>();
const inFlight = new Map<string, Promise<OverpassLayerQuery>>();
let activeRequests = 0;
const queuedRequests: Array<() => void> = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLiveQueryBboxSafe(bbox: unknown): bbox is Bbox {
  return isValidBbox(bbox) &&
    bbox[2] - bbox[0] <= MAX_BBOX_WIDTH &&
    bbox[3] - bbox[1] <= MAX_BBOX_HEIGHT;
}

export function buildOverpassQuery(layerId: CurrentOsmLayerId, bbox: Bbox): string {
  const [west, south, east, north] = bbox;
  const bboxClause = `(${south},${west},${north},${east})`;
  const nodeAndWaySelectors = SELECTORS[layerId]
    .flatMap((selector) => [`node${selector}${bboxClause};`, `way${selector}${bboxClause};`])
    .join("\n  ");
  const relationSelectors = SELECTORS[layerId]
    .map((selector) => `relation${selector}${bboxClause};`)
    .join("\n  ");
  return `[out:json][timeout:20][maxsize:67108864];\n(\n  ${nodeAndWaySelectors}\n);\nout body geom qt ${MAX_NODE_WAY_FEATURES};\n(\n  ${relationSelectors}\n);\nout body center qt ${MAX_RELATION_FEATURES};`;
}

function positionFromLatLon(lat: unknown, lon: unknown): Position | null {
  const position: unknown = [lon, lat];
  return isFinitePosition(position) ? position : null;
}

function positionsFromGeometry(value: unknown): Position[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const positions: Position[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const position = positionFromLatLon(candidate.lat, candidate.lon);
    if (!position) return null;
    positions.push(position);
  }
  return positions;
}

function positionsEqual(first: Position, second: Position): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function geometryFromElement(element: OsmElement): {
  geometry: ResearchGeometry;
  positions: Position[];
  geography: ResearchFeature["confidence"]["geography"];
} | null {
  // Relation topology is not reconstructed. `out center` is retained only as an explicitly approximate point.
  if (element.type === "relation") {
    const center = element.center ? positionFromLatLon(element.center.lat, element.center.lon) : null;
    return center ? { geometry: { type: "Point", coordinates: center }, positions: [center], geography: "approximate" } : null;
  }
  const point = positionFromLatLon(element.lat, element.lon) ??
    (element.center ? positionFromLatLon(element.center.lat, element.center.lon) : null);
  if (element.type === "node" && point) {
    return { geometry: { type: "Point", coordinates: point }, positions: [point], geography: "exact" };
  }
  const positions = positionsFromGeometry(element.geometry);
  if (!positions) return null;
  if (positions.length === 1) {
    return { geometry: { type: "Point", coordinates: positions[0] }, positions, geography: "exact" };
  }
  if (positions.length >= 4 && positionsEqual(positions[0], positions[positions.length - 1])) {
    return { geometry: { type: "Polygon", coordinates: [positions] }, positions, geography: "exact" };
  }
  return { geometry: { type: "LineString", coordinates: positions }, positions, geography: "exact" };
}

const CATEGORY_KEYS_BY_LAYER: Partial<Record<CurrentOsmLayerId, readonly string[]>> = {
  transport: ["public_transport", "railway", "highway", "amenity", "aeroway"],
  roads: ["highway"],
  healthcare: ["healthcare", "amenity"],
  education: ["amenity"],
  daily_needs: ["shop", "amenity"],
  emergency: ["emergency", "amenity"],
  parks: ["leisure"],
  recreation: ["leisure", "landuse"],
  civic: ["amenity"],
  utilities: ["power", "construction:power", "man_made"],
  water: ["natural", "waterway", "landuse"],
  land_use: ["landuse"],
  industrial_waste: ["landuse", "amenity", "man_made", "industrial"],
};

function elementCategory(element: OsmElement, layerId: CurrentOsmLayerId): string {
  const tags = element.tags ?? {};
  for (const key of CATEGORY_KEYS_BY_LAYER[layerId] ?? []) {
    const value = tags[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "feature";
}

function elementTitle(element: OsmElement, layerId: CurrentOsmLayerId): string {
  const name = element.tags?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return `${elementCategory(element, layerId).replace(/_/g, " ")} (${element.type} ${element.id})`;
}

function elementDescription(element: OsmElement, layerId: CurrentOsmLayerId): string {
  return `OpenStreetMap records this ${elementCategory(element, layerId).replace(/_/g, " ")} inside the selected area.`;
}

const ATTRIBUTE_TAGS: readonly [key: string, label: string][] = [
  ["amenity", "Amenity"],
  ["healthcare", "Healthcare"],
  ["shop", "Shop"],
  ["leisure", "Leisure"],
  ["landuse", "Land use"],
  ["power", "Power"],
  ["construction:power", "Construction power"],
  ["man_made", "Structure"],
  ["emergency", "Emergency"],
  ["highway", "Road class"],
  ["railway", "Railway"],
  ["public_transport", "Public transport"],
  ["aeroway", "Aeroway"],
  ["natural", "Natural"],
  ["waterway", "Waterway"],
  ["operator", "Operator"],
  ["brand", "Brand"],
  ["opening_hours", "Opening hours"],
  ["emergency", "Emergency"],
  ["healthcare:speciality", "Speciality"],
  ["capacity", "Capacity"],
  ["wheelchair", "Wheelchair"],
  ["fee", "Fee"],
  ["access", "Access"],
  ["voltage", "Voltage"],
  ["plant:source", "Plant source"],
  ["industrial", "Industry"],
  ["sport", "Sport"],
  ["start_date", "Start date"],
  ["website", "Website"],
  ["contact:website", "Website"],
  ["phone", "Phone"],
  ["contact:phone", "Phone"],
];

function elementAttributes(element: OsmElement): ResearchFeature["attributes"] {
  const tags = element.tags ?? {};
  const seenLabels = new Set<string>();
  return ATTRIBUTE_TAGS.flatMap(([key, label]) => {
    const value = tags[key];
    if (typeof value !== "string" || !value.trim() || seenLabels.has(label)) return [];
    seenLabels.add(label);
    return [{ label, value: value.trim().slice(0, 160) }];
  }).slice(0, 12);
}

function elementStatus(element: OsmElement): ResearchFeature["status"] {
  const tags = element.tags ?? {};
  return typeof tags.construction === "string" ||
    Object.keys(tags).some((key) => key.startsWith("construction:"))
    ? "construction"
    : "reported";
}

function isOverpassPayload(value: unknown): value is OverpassPayload {
  return isRecord(value) && Array.isArray(value.elements) && value.elements.every((element) =>
    isRecord(element) && (element.type === "node" || element.type === "way" || element.type === "relation") &&
    typeof element.id === "number" && Number.isFinite(element.id),
  );
}

function normalizedFeature(
  element: OsmElement,
  layerId: CurrentOsmLayerId,
  areaGeometry: AreaSelection["geometry"],
  timestamp: string | undefined,
): ResearchFeature | null {
  const resolved = geometryFromElement(element);
  if (!resolved || !positionsAndSegmentsStrictlyInside(resolved.positions, areaGeometry)) return null;
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  return {
    id: `osm:${element.type}/${element.id}`,
    layerId,
    title: elementTitle(element, layerId),
    geometry: resolved.geometry,
    mode: "current",
    status: elementStatus(element),
    impact: "unclear",
    explanation: elementDescription(element, layerId),
    attributes: elementAttributes(element),
    source: {
      name: "OpenStreetMap",
      url: sourceUrl,
      sourceType: "community",
      fetchedAt: new Date().toISOString(),
      publishedAt: timestamp,
    },
    confidence: {
      evidence: "medium",
      geography: resolved.geography,
    },
  };
}

export type OverpassLayerQuery = {
  features: ResearchFeature[];
  osmBaseTimestamp?: string;
};

function cacheKey(area: Pick<AreaSelection, "geometry" | "bbox">, layerId: CurrentOsmLayerId): string {
  return `${layerId}:${JSON.stringify(area.geometry)}:${area.bbox.join(",")}`;
}

function storeCachedResult(key: string, value: OverpassLayerQuery): void {
  const now = Date.now();
  for (const [cachedKey, cached] of cache) {
    if (cached.expiresAt <= now) cache.delete(cachedKey);
  }
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}

async function withOverpassSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => queuedRequests.push(resolve));
  }
  activeRequests += 1;
  try {
    return await operation();
  } finally {
    activeRequests -= 1;
    queuedRequests.shift()?.();
  }
}

async function requestOverpassLayer(
  area: Pick<AreaSelection, "geometry" | "bbox">,
  layerId: CurrentOsmLayerId,
  fetcher: typeof fetch,
): Promise<OverpassLayerQuery> {
  const query = buildOverpassQuery(layerId, area.bbox);
  return withOverpassSlot(async () => {
    const response = await fetcher(OVERPASS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Basera/0.1 (geospatial research; https://github.com/nirmalhk7/basera)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Overpass request failed (${response.status})`);
    const payload = await readJsonWithByteLimit(response, MAX_CONTENT_LENGTH);
    if (!isOverpassPayload(payload)) throw new Error("Overpass response has an invalid shape");
    const timestamp = typeof payload.osm3s?.timestamp_osm_base === "string" ? payload.osm3s.timestamp_osm_base : undefined;
    const features = payload.elements.slice(0, MAX_FEATURES)
      .map((element) => normalizedFeature(element, layerId, area.geometry, timestamp))
      .filter((feature): feature is ResearchFeature => feature !== null);
    return { features, osmBaseTimestamp: timestamp };
  });
}

export async function queryOverpassLayer(
  area: Pick<AreaSelection, "geometry" | "bbox">,
  layerId: CurrentOsmLayerId,
  fetcher: typeof fetch = fetch,
): Promise<OverpassLayerQuery> {
  if (!isLiveQueryBboxSafe(area.bbox)) throw new Error("Selected area bounding box is invalid or too large for a live Overpass query");
  if (!isAreaGeometry(area.geometry)) {
    throw new Error("Selected area geometry must be a Polygon or MultiPolygon");
  }
  if (!bboxMatchesGeometry(area.bbox, area.geometry)) {
    throw new Error("Selected area bounding box does not match its geometry");
  }
  if (fetcher !== fetch) return requestOverpassLayer(area, layerId, fetcher);
  const key = cacheKey(area, layerId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);
  const active = inFlight.get(key);
  if (active) return active;
  const request = requestOverpassLayer(area, layerId, fetcher)
    .then((value) => {
      storeCachedResult(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

// Keeps the selector data closed over; exported for route-level input validation only.
export function isSupportedLayerId(value: unknown): value is CurrentOsmLayerId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SELECTORS, value);
}

export function clearOverpassConnectorCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
