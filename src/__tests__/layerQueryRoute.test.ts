import { afterEach, describe, expect, it, vi } from "vitest";

const { resolveNominatimArea } = vi.hoisted(() => ({
  resolveNominatimArea: vi.fn(),
}));

vi.mock("@/server/connectors/nominatim", () => ({ resolveNominatimArea }));

import { POST } from "@/app/api/layers/query/route";
import { clearOverpassConnectorCacheForTests } from "@/server/connectors/overpass";
import type { AreaSelection } from "@/types/research";

const originalFetch = global.fetch;
const area: AreaSelection = {
  id: "osm:relation/1",
  name: "Test area",
  displayName: "Test area, India",
  countryCode: "in",
  source: { name: "OpenStreetMap Nominatim", url: "https://www.openstreetmap.org/relation/1" },
  geometry: { type: "Polygon", coordinates: [[[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]]] },
  bbox: [77, 28, 78, 29],
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/layers/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chunkedRequest(chunks: readonly Uint8Array[]): { request: Request; wasCancelled: () => boolean } {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    request: new Request("http://localhost/api/layers/query", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    wasCancelled: () => cancelled,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  clearOverpassConnectorCacheForTests();
  resolveNominatimArea.mockReset();
  vi.restoreAllMocks();
});

describe("POST /api/layers/query", () => {
  it("returns live current OSM features with coverage metadata", async () => {
    resolveNominatimArea.mockResolvedValue(area);
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      osm3s: { timestamp_osm_base: "2026-07-26T12:00:00Z" },
      elements: [{ type: "node", id: 42, lat: 28.5, lon: 77.5, tags: { highway: "bus_stop", name: "Recorded stop" } }],
    }), { status: 200 })) as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["transport"] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(resolveNominatimArea).toHaveBeenCalledWith(area.id);
    expect(body.area).toMatchObject({ id: area.id, geometry: area.geometry, bbox: area.bbox });
    expect(body.layers[0].features[0].source.url).toBe("https://www.openstreetmap.org/node/42");
    expect(body.layers[0].coverage).toMatchObject({ level: "partial", sourcesSucceeded: [{ name: "OpenStreetMap" }] });
  });

  it("reports future mode as unavailable with no fabricated features", async () => {
    resolveNominatimArea.mockResolvedValue(area);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "future", layerIds: ["transport"] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.layers[0]).toMatchObject({ layerId: "transport", features: [], coverage: { level: "unavailable" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid identities and layers without reaching either upstream", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const invalidAreaId = await POST(request({ areaId: "osm:node/1", mode: "current", layerIds: ["roads"] }));
    const invalidLayerId = await POST(request({ areaId: area.id, mode: "current", layerIds: ["unknown"] }));

    expect(invalidAreaId.status).toBe(400);
    expect(invalidLayerId.status).toBe(400);
    expect(resolveNominatimArea).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects supplied boundary data instead of accepting client GeoJSON", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(request({ areaId: area.id, area, mode: "current", layerIds: ["roads"] }));

    expect(response.status).toBe(400);
    expect(resolveNominatimArea).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels a chunked oversized body even when Content-Length is misreported", async () => {
    const encoder = new TextEncoder();
    const streamed = chunkedRequest([encoder.encode("x".repeat(8_192)), encoder.encode("x")]);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(streamed.request);

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(resolveNominatimArea).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not found when a valid area identity cannot be resolved", async () => {
    resolveNominatimArea.mockResolvedValue(null);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports resolver failures without a fallback area", async () => {
    resolveNominatimArea.mockRejectedValue(new Error("Nominatim unavailable"));
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain("No fallback");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unsafe resolved boundary before Overpass", async () => {
    resolveNominatimArea.mockResolvedValue({ ...area, bbox: [77, 28, 77, 29] });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));

    expect(response.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose a resolved area outside India to Overpass", async () => {
    const outsideIndia: AreaSelection = {
      ...area,
      geometry: { type: "Polygon", coordinates: [[[2, 48], [3, 48], [3, 49], [2, 49], [2, 48]]] },
      bbox: [2, 48, 3, 49],
    };
    resolveNominatimArea.mockResolvedValue(outsideIndia);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));

    // 404 deliberately avoids confirming that an arbitrary global OSM identity resolved.
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects resolver identity mismatches and missing or foreign country codes before Overpass", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    const invalidAreas: readonly AreaSelection[] = [
      { ...area, id: "osm:relation/2" },
      { ...area, countryCode: undefined },
      { ...area, countryCode: "fr" },
    ];

    for (const resolvedArea of invalidAreas) {
      resolveNominatimArea.mockResolvedValueOnce(resolvedArea);
      const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a tiny request when the resolved boundary exceeds the former 200 KB body cap", async () => {
    const edgeSteps = 3_000;
    const ring = [
      ...Array.from({ length: edgeSteps }, (_, index) => [77 + index / edgeSteps, 28] as const),
      ...Array.from({ length: edgeSteps }, (_, index) => [78, 28 + index / edgeSteps] as const),
      ...Array.from({ length: edgeSteps }, (_, index) => [78 - index / edgeSteps, 29] as const),
      ...Array.from({ length: edgeSteps + 1 }, (_, index) => [77, 29 - index / edgeSteps] as const),
    ];
    const detailedArea: AreaSelection = {
      ...area,
      geometry: { type: "Polygon", coordinates: [ring] },
      bbox: [77, 28, 78, 29],
    };
    expect(JSON.stringify(detailedArea.geometry).length).toBeGreaterThan(200_000);
    resolveNominatimArea.mockResolvedValue(detailedArea);
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ elements: [] }), { status: 200 })) as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("distinguishes a successful empty result from unavailable or failed coverage", async () => {
    resolveNominatimArea.mockResolvedValue(area);
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ elements: [] }), { status: 200 })) as typeof fetch;

    const response = await POST(request({ areaId: area.id, mode: "current", layerIds: ["roads"] }));
    const body = await response.json();

    expect(body.layers[0]).toMatchObject({
      features: [],
      coverage: {
        level: "partial",
        message: expect.stringContaining("found nothing"),
      },
    });
  });
});
