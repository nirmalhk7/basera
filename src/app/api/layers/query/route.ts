import { NextResponse } from "next/server";
import { getResearchLayer } from "@/config/researchLayers";
import { bboxMatchesGeometry, INDIA_BBOX, isAreaGeometry } from "@/server/geo";
import { resolveNominatimArea } from "@/server/connectors/nominatim";
import { isLiveQueryBboxSafe, isSupportedLayerId, queryOverpassLayer } from "@/server/connectors/overpass";
import type { AreaSelection, LayerCoverage, LayerId, LayerQueryRequest, LayerQueryResponse, LayerResult, ResearchMode, SourceReference } from "@/types/research";

const MAX_BODY_BYTES = 8_192;
const MAX_LAYERS = 17;
const AREA_ID_PATTERN = /^osm:(?:relation|way)\/[1-9]\d*$/;
const CACHE_HEADERS = { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300" };

const LAYER_IDS: readonly LayerId[] = [
  "transport", "roads", "healthcare", "education", "daily_needs", "emergency", "parks", "recreation",
  "civic", "utilities", "water", "land_use", "industrial_waste",
  "flood", "air_quality", "environmental_clearances", "government_plans",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLayerId(value: unknown): value is LayerId {
  return typeof value === "string" && (LAYER_IDS as readonly string[]).includes(value);
}

function isSourceReference(value: unknown): value is SourceReference {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() || typeof value.url !== "string") return false;
  try {
    const url = new URL(value.url);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAreaSelection(value: unknown): value is AreaSelection {
  return isRecord(value) &&
    typeof value.id === "string" && value.id.trim().length > 0 &&
    typeof value.name === "string" && value.name.trim().length > 0 &&
    typeof value.displayName === "string" && value.displayName.trim().length > 0 &&
    isSourceReference(value.source) && isAreaGeometry(value.geometry) &&
    isLiveQueryBboxSafe(value.bbox) && bboxMatchesGeometry(value.bbox, value.geometry);
}

function isWithinIndiaBbox(bbox: AreaSelection["bbox"]): boolean {
  return bbox[0] >= INDIA_BBOX[0] && bbox[1] >= INDIA_BBOX[1] &&
    bbox[2] <= INDIA_BBOX[2] && bbox[3] <= INDIA_BBOX[3];
}

class RequestBodyTooLargeError extends Error {}

async function readRequestBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        try {
          await reader.cancel("Request body is too large.");
        } catch {
          // The request is already rejected below; cancellation is best-effort for a broken stream.
        }
        throw new RequestBodyTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function isLayerQueryRequest(value: unknown): value is LayerQueryRequest {
  return isRecord(value) &&
    Object.keys(value).length === 3 && ["areaId", "mode", "layerIds"].every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    typeof value.areaId === "string" && AREA_ID_PATTERN.test(value.areaId) &&
    (value.mode === "current" || value.mode === "future") &&
    Array.isArray(value.layerIds) && value.layerIds.length > 0 && value.layerIds.length <= MAX_LAYERS &&
    value.layerIds.every(isLayerId);
}

function sourceReferences(layerId: LayerId): SourceReference[] {
  const layer = getResearchLayer(layerId);
  return (layer?.sourceRequirements ?? [])
    .flatMap((source) => source.url ? [{ name: source.name, url: source.url }] : []);
}

function unavailableCoverage(layerId: LayerId, mode: ResearchMode): LayerCoverage {
  return {
    layerId,
    level: "unavailable",
    message: `No live ${mode} source adapter is configured for this layer; no features were generated.`,
    sourcesChecked: sourceReferences(layerId),
    sourcesSucceeded: [],
  };
}

function failedCoverage(layerId: LayerId, reason: unknown): LayerCoverage {
  const detail = reason instanceof Error ? reason.message : "Unknown upstream failure";
  return {
    layerId,
    level: "failed",
    message: `OpenStreetMap query failed: ${detail}. No fallback features were generated.`,
    sourcesChecked: sourceReferences(layerId),
    sourcesSucceeded: [],
  };
}

function completedCoverage(layerId: LayerId, featureCount: number, osmBaseTimestamp?: string): LayerCoverage {
  const timestamp = osmBaseTimestamp ? ` OSM base timestamp: ${osmBaseTimestamp}.` : "";
  return {
    layerId,
    level: featureCount === 0 ? "weak" : "partial",
    message: `Live OpenStreetMap query completed with ${featureCount} feature${featureCount === 1 ? "" : "s"}. Results are capped and only geometry proven strictly inside the selected area is returned.${timestamp}`,
    sourcesChecked: [{ name: "OpenStreetMap", url: "https://www.openstreetmap.org/" }],
    sourcesSucceeded: [{ name: "OpenStreetMap", url: "https://www.openstreetmap.org/" }],
  };
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: CACHE_HEADERS });
  }

  let payload: unknown;
  let text: string;
  try {
    text = await readRequestBody(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: CACHE_HEADERS });
    }
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: CACHE_HEADERS });
  }
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: CACHE_HEADERS });
  }
  if (!isLayerQueryRequest(payload)) {
    return NextResponse.json({ error: "Invalid layer query request." }, { status: 400, headers: CACHE_HEADERS });
  }

  let area: AreaSelection | null;
  try {
    area = await resolveNominatimArea(payload.areaId);
  } catch {
    return NextResponse.json({ error: "Area resolution failed. No fallback area was used." }, { status: 502, headers: CACHE_HEADERS });
  }
  if (area === null) {
    return NextResponse.json({ error: "Area identity could not be resolved." }, { status: 404, headers: CACHE_HEADERS });
  }
  // The identity resolver is upstream input too. Recheck all geometry and bbox invariants before Overpass.
  if (!isAreaSelection(area)) {
    return NextResponse.json({ error: "Resolved area is invalid. No fallback area was used." }, { status: 502, headers: CACHE_HEADERS });
  }
  // Do not confirm mismatched or globally resolved identities to this India-only endpoint.
  if (area.id !== payload.areaId || area.countryCode !== "in" || !isWithinIndiaBbox(area.bbox)) {
    return NextResponse.json({ error: "Area identity could not be resolved within the supported region." }, { status: 404, headers: CACHE_HEADERS });
  }

  const uniqueLayerIds = [...new Set(payload.layerIds)];
  const resultByLayer = new Map<LayerId, LayerResult>();
  const supportedCurrentLayerIds = payload.mode === "current" ? uniqueLayerIds.filter(isSupportedLayerId) : [];
  const pending = supportedCurrentLayerIds
    .map(async (layerId) => ({ layerId, result: await queryOverpassLayer(area, layerId) }));
  const settled = await Promise.allSettled(pending);

  for (const layerId of uniqueLayerIds) {
    if (payload.mode !== "current" || !isSupportedLayerId(layerId)) {
      resultByLayer.set(layerId, { layerId, features: [], coverage: unavailableCoverage(layerId, payload.mode) });
    }
  }
  for (const [index, settledResult] of settled.entries()) {
    const layerId = supportedCurrentLayerIds[index];
    if (settledResult.status === "fulfilled") {
      const { result } = settledResult.value;
      resultByLayer.set(layerId, {
        layerId,
        features: result.features,
        coverage: completedCoverage(layerId, result.features.length, result.osmBaseTimestamp),
      });
    } else {
      resultByLayer.set(layerId, {
        layerId,
        features: [],
        coverage: failedCoverage(layerId, settledResult.reason),
      });
    }
  }

  const response: LayerQueryResponse = {
    area,
    mode: payload.mode,
    layers: uniqueLayerIds.map((layerId) => resultByLayer.get(layerId) ?? {
      layerId,
      features: [],
      coverage: failedCoverage(layerId, "Layer result was not produced"),
    }),
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(response, { headers: CACHE_HEADERS });
}
