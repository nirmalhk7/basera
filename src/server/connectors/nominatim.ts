import { bboxForGeometry, INDIA_BBOX, isAreaGeometry } from "@/server/geo";
import { readJsonWithByteLimit } from "@/server/http";
import { toBoundaryCandidate, type BoundaryProvider } from "@/server/boundaries";
import type { AreaSearchResult } from "@/types/research";

const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const TIMEOUT_MS = 8_000;
const MAX_RESULTS = 5;
const MAX_RESPONSE_BYTES = 2_000_000;
const CACHE_TTL_MS = 60 * 60 * 1_000;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 200;
const MAX_RATE_QUEUE_MS = 2_000;

const cache = new Map<string, { expiresAt: number; value: NominatimSearchResponse }>();
const inFlight = new Map<string, Promise<NominatimSearchResponse>>();
const areaCache = new Map<string, { expiresAt: number; value: AreaSearchResult | null }>();
const areaInFlight = new Map<string, Promise<AreaSearchResult | null>>();
let nextDefaultRequestAt = 0;

export type NominatimSearchResponse = {
  areas: AreaSearchResult[];
  source: { name: string; url: string; attribution: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nominatimBaseUrl(): string {
  const configured = process.env.NOMINATIM_BASE_URL?.trim();
  if (!configured) return DEFAULT_NOMINATIM_BASE_URL;
  try {
    const parsed = new URL(configured);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash
    ) return DEFAULT_NOMINATIM_BASE_URL;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_NOMINATIM_BASE_URL;
  }
}

type NominatimOsmType = "node" | "way" | "relation";

type NominatimAreaIdentifier = {
  id: string;
  osmId: string;
  osmType: NominatimOsmType;
};

function parseNominatimAreaId(value: string): NominatimAreaIdentifier | null {
  const match = /^osm:(node|way|relation)\/([1-9]\d*)$/.exec(value);
  if (!match) return null;
  const [, osmType, osmId] = match;
  return { id: value, osmType: osmType as NominatimOsmType, osmId };
}

function normalizeNominatimAreaIdentifier(osmType: unknown, osmId: unknown): NominatimAreaIdentifier | null {
  const rawType = optionalString(osmType);
  const rawId = typeof osmId === "number" || typeof osmId === "string" ? String(osmId) : "";
  return rawType ? parseNominatimAreaId(`osm:${rawType}/${rawId}`) : null;
}

function normalizeResult(value: unknown): AreaSearchResult | null {
  if (!isRecord(value) || !isAreaGeometry(value.geojson)) return null;
  const displayName = optionalString(value.display_name);
  const identifier = normalizeNominatimAreaIdentifier(value.osm_type, value.osm_id);
  if (!displayName || !identifier) return null;

  const address = isRecord(value.address) ? value.address : {};
  if (address.country_code !== "in") return null;
  const name = optionalString(value.name) ??
    optionalString(address.city) ?? optionalString(address.town) ?? optionalString(address.village) ??
    optionalString(address.county) ?? displayName.split(",")[0]?.trim();
  if (!name) return null;

  return {
    id: identifier.id,
    name,
    displayName,
    countryCode: "in",
    state: optionalString(address.state),
    district: optionalString(address.county) ?? optionalString(address.state_district),
    source: {
      name: "OpenStreetMap Nominatim",
      url: `https://www.openstreetmap.org/${identifier.osmType}/${identifier.osmId}`,
    },
    boundary: {
      sourceType: "community",
      confidence: "medium",
      editable: true,
    },
    geometry: value.geojson,
    bbox: bboxForGeometry(value.geojson),
  };
}

function cacheKey(query: string): string {
  return query.trim().toLocaleLowerCase("en-US");
}

function storeCachedResult(key: string, value: NominatimSearchResponse): void {
  const now = Date.now();
  for (const [cachedKey, cached] of cache) {
    if (cached.expiresAt <= now) cache.delete(cachedKey);
  }
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}

function storeCachedAreaValue(areaId: string, value: AreaSearchResult | null, ttlMs: number): void {
  const now = Date.now();
  for (const [cachedKey, cached] of areaCache) {
    if (cached.expiresAt <= now) areaCache.delete(cachedKey);
  }
  if (areaCache.size >= MAX_CACHE_ENTRIES) areaCache.delete(areaCache.keys().next().value as string);
  areaCache.set(areaId, { value, expiresAt: now + ttlMs });
}

function storeCachedArea(area: AreaSearchResult): void {
  storeCachedAreaValue(area.id, area, CACHE_TTL_MS);
}

function storeUnresolvedArea(areaId: string): void {
  storeCachedAreaValue(areaId, null, NEGATIVE_CACHE_TTL_MS);
}

async function waitForNominatimRateLimit(): Promise<void> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextDefaultRequestAt);
  const waitMs = scheduledAt - now;
  if (waitMs > MAX_RATE_QUEUE_MS) throw new Error("Nominatim rate limit queue is busy; retry shortly");
  nextDefaultRequestAt = scheduledAt + 1_000;
  if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
}

async function requestNominatimAreas(query: string, fetcher: typeof fetch, rateLimited: boolean): Promise<NominatimSearchResponse> {
  if (rateLimited) await waitForNominatimRateLimit();
  const params = new URLSearchParams({
    q: query,
    countrycodes: "in",
    format: "jsonv2",
    addressdetails: "1",
    polygon_geojson: "1",
    bounded: "1",
    viewbox: `${INDIA_BBOX[0]},${INDIA_BBOX[3]},${INDIA_BBOX[2]},${INDIA_BBOX[1]}`,
    limit: String(MAX_RESULTS),
  });
  const response = await fetcher(`${nominatimBaseUrl()}/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "Basera/0.1 (geospatial research; https://github.com/nirmalhk7/basera)",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nominatim request failed (${response.status})`);
  const payload = await readJsonWithByteLimit(response, MAX_RESPONSE_BYTES);
  if (!Array.isArray(payload)) throw new Error("Nominatim response has an invalid shape");
  const areas = payload.slice(0, MAX_RESULTS).map(normalizeResult).filter((area): area is AreaSearchResult => area !== null);
  return {
    areas,
    source: {
      name: "OpenStreetMap Nominatim",
      url: `${nominatimBaseUrl()}/`,
      attribution: "Search data © OpenStreetMap contributors, via Nominatim",
    },
  };
}

async function requestNominatimAreaLookup(
  identifier: NominatimAreaIdentifier,
  fetcher: typeof fetch,
  rateLimited: boolean,
): Promise<AreaSearchResult | null> {
  if (rateLimited) await waitForNominatimRateLimit();
  const osmPrefix = { node: "N", way: "W", relation: "R" }[identifier.osmType];
  const params = new URLSearchParams({
    osm_ids: `${osmPrefix}${identifier.osmId}`,
    format: "jsonv2",
    addressdetails: "1",
    polygon_geojson: "1",
  });
  const response = await fetcher(`${nominatimBaseUrl()}/lookup?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "Basera/0.1 (geospatial research; https://github.com/nirmalhk7/basera)",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nominatim request failed (${response.status})`);
  const payload = await readJsonWithByteLimit(response, MAX_RESPONSE_BYTES);
  if (!Array.isArray(payload)) throw new Error("Nominatim response has an invalid shape");
  return payload.map(normalizeResult).find((area): area is AreaSearchResult => area?.id === identifier.id) ?? null;
}

export async function searchNominatimAreas(query: string, fetcher: typeof fetch = fetch): Promise<NominatimSearchResponse> {
  // Injected transports are used for deterministic replay tests and deliberately bypass process cache/rate state.
  if (fetcher !== fetch) return requestNominatimAreas(query, fetcher, false);
  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);
  const active = inFlight.get(key);
  if (active) return active;

  const request = requestNominatimAreas(query, fetcher, true)
    .then((value) => {
      storeCachedResult(key, value);
      value.areas.forEach(storeCachedArea);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export async function resolveNominatimArea(areaId: string, fetcher: typeof fetch = fetch): Promise<AreaSearchResult | null> {
  const identifier = parseNominatimAreaId(areaId);
  if (!identifier) return null;

  // Injected transports are used for deterministic replay tests and deliberately bypass process cache/rate state.
  if (fetcher !== fetch) return requestNominatimAreaLookup(identifier, fetcher, false);
  const cached = areaCache.get(identifier.id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) areaCache.delete(identifier.id);
  const active = areaInFlight.get(identifier.id);
  if (active) return active;

  const request = requestNominatimAreaLookup(identifier, fetcher, true)
    .then((area) => {
      if (area) storeCachedArea(area);
      else storeUnresolvedArea(identifier.id);
      return area;
    })
    .finally(() => areaInFlight.delete(identifier.id));
  areaInFlight.set(identifier.id, request);
  return request;
}

export function clearNominatimConnectorCacheForTests(): void {
  cache.clear();
  inFlight.clear();
  areaCache.clear();
  areaInFlight.clear();
  nextDefaultRequestAt = 0;
}

/** Community fallback only; official providers are registered independently in the boundary layer. */
export function createNominatimBoundaryProvider(fetcher: typeof fetch = fetch): BoundaryProvider {
  return {
    metadata: {
      id: "nominatim",
      name: "OpenStreetMap Nominatim",
      provenance: "community",
      authority: "OpenStreetMap community data",
      termsUrl: "https://www.openstreetmap.org/copyright",
      health: "healthy",
      supportedSearchKinds: ["locality", "ward", "village", "town", "pin", "address", "project", "landmark"],
    },
    async search(intent) {
      if (!this.metadata.supportedSearchKinds.includes(intent.kind)) return [];
      const response = await searchNominatimAreas(intent.query, fetcher);
      return response.areas.map((area) => toBoundaryCandidate(area, "nominatim", intent.kind, true));
    },
    async resolve(id) {
      const area = await resolveNominatimArea(id, fetcher);
      return area ? toBoundaryCandidate(area, "nominatim", "locality", true) : null;
    },
  };
}
