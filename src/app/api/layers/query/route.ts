import { NextResponse } from "next/server";
import { resolveAreaReference } from "@/server/connectors/areaReferences";
import { bboxMatchesGeometry, INDIA_BBOX, isAreaGeometry } from "@/server/geo";
import { BodyTooLargeError, PRIVATE_NO_STORE_HEADERS, readJsonWithByteLimit } from "@/server/http";
import { isLiveQueryBboxSafe } from "@/server/connectors/overpass";
import { orchestrateLayerQueries } from "@/server/connectors/registry";
import type { AreaSelection, LayerId, LayerQueryRequest, LayerQueryResponse, SourceReference } from "@/types/research";

const MAX_BODY_BYTES = 8_192;
const MAX_LAYERS = 17;
const AREA_ID_PATTERN = /^(?:osm:(?:relation|way)\/[1-9]\d*|user:boundary\/[0-9a-f-]{36})$/;
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

function isLayerQueryRequest(value: unknown): value is LayerQueryRequest {
  return isRecord(value) &&
    Object.keys(value).length === 3 && ["areaId", "mode", "layerIds"].every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    typeof value.areaId === "string" && AREA_ID_PATTERN.test(value.areaId) &&
    (value.mode === "current" || value.mode === "future") &&
    Array.isArray(value.layerIds) && value.layerIds.length > 0 && value.layerIds.length <= MAX_LAYERS &&
    value.layerIds.every(isLayerId);
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await readJsonWithByteLimit(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: CACHE_HEADERS });
    }
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: CACHE_HEADERS });
  }
  if (!isLayerQueryRequest(payload)) {
    return NextResponse.json({ error: "Invalid layer query request." }, { status: 400, headers: CACHE_HEADERS });
  }

  const headers = payload.areaId.startsWith("user:boundary/") ? PRIVATE_NO_STORE_HEADERS : CACHE_HEADERS;
  let area: AreaSelection | null;
  try {
    area = await resolveAreaReference(payload.areaId);
  } catch {
    return NextResponse.json({ error: "Area resolution failed. No fallback area was used." }, { status: 502, headers });
  }
  if (area === null) {
    return NextResponse.json({ error: "Area identity could not be resolved." }, { status: 404, headers });
  }
  // The identity resolver is upstream input too. Recheck all geometry and bbox invariants before Overpass.
  if (!isAreaSelection(area)) {
    return NextResponse.json({ error: "Resolved area is invalid. No fallback area was used." }, { status: 502, headers });
  }
  // Do not confirm mismatched or globally resolved identities to this India-only endpoint.
  if (area.id !== payload.areaId || area.countryCode !== "in" || !isWithinIndiaBbox(area.bbox)) {
    return NextResponse.json({ error: "Area identity could not be resolved within the supported region." }, { status: 404, headers });
  }

  const uniqueLayerIds = [...new Set(payload.layerIds)];
  const orchestration = await orchestrateLayerQueries(area, payload.mode, uniqueLayerIds, request.signal);

  const response: LayerQueryResponse = {
    area,
    mode: payload.mode,
    layers: orchestration.layers.map(({ layerId, result }) => ({ layerId, features: result.features, coverage: result.coverage })),
    nonSpatialEvidence: orchestration.layers.flatMap(({ result }) => result.nonSpatialEvidence),
    providerOutcomes: orchestration.providerOutcomes,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(response, { headers });
}
