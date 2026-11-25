import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOverpassQuery, clearOverpassConnectorCacheForTests, queryOverpassLayer } from "@/server/connectors/overpass";
import { readJsonWithByteLimit } from "@/server/http";
import type { AreaSelection } from "@/types/research";

const originalFetch = global.fetch;

const area: AreaSelection = {
  id: "osm:relation/1",
  name: "Test area",
  displayName: "Test area, India",
  source: { name: "OpenStreetMap Nominatim", url: "https://www.openstreetmap.org/relation/1" },
  geometry: {
    type: "Polygon",
    coordinates: [[[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]]],
  },
  bbox: [77, 28, 78, 29],
};

afterEach(() => {
  global.fetch = originalFetch;
  clearOverpassConnectorCacheForTests();
  vi.restoreAllMocks();
});

describe("Overpass connector", () => {
  it("uses real OSM selectors and preserves only complete geometry strictly inside the selected area", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      osm3s: { timestamp_osm_base: "2026-07-26T12:00:00Z" },
      elements: [
        { type: "node", id: 10, lat: 28.5, lon: 77.5, tags: { amenity: "hospital", name: "Recorded Hospital" } },
        { type: "node", id: 11, lat: 29.2, lon: 77.5, tags: { amenity: "hospital" } },
        { type: "way", id: 12, tags: { amenity: "hospital" } },
        { type: "relation", id: 13, geometry: [{ lat: 28.5, lon: 77.5 }], tags: { amenity: "hospital" } },
      ],
    }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await queryOverpassLayer(area, "healthcare");

    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toMatchObject({
      id: "osm:node/10",
      title: "Recorded Hospital",
      mode: "current",
      status: "reported",
      impact: "unclear",
      source: {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org/node/10",
        sourceType: "community",
        datasetUpdatedAt: "2026-07-26T12:00:00Z",
      },
    });
    expect(buildOverpassQuery("transport", area.bbox)).toContain('["railway"~"^(station|halt)$"]');
    expect(buildOverpassQuery("land_use", area.bbox)).toContain('["landuse"]');
    expect(buildOverpassQuery("daily_needs", area.bbox)).toContain('["amenity"="marketplace"]');
    expect(buildOverpassQuery("industrial_waste", area.bbox)).toContain('["landuse"~"^(industrial|landfill)$"]');
    expect(buildOverpassQuery("daily_needs", area.bbox)).toContain("out body center qt 100");
  });

  it("keeps relation-backed facilities as approximate points and exposes selected source tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      elements: [{
        type: "relation",
        id: 31,
        center: { lat: 28.5, lon: 77.5 },
        tags: {
          amenity: "marketplace",
          name: "Recorded Market",
          operator: "Municipal market board",
          opening_hours: "Mo-Sa 08:00-20:00",
        },
      }],
    }), { status: 200 }));

    const result = await queryOverpassLayer(area, "daily_needs", fetchMock as typeof fetch);

    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toMatchObject({
      id: "osm:relation/31",
      title: "Recorded Market",
      geometry: { type: "Point", coordinates: [77.5, 28.5] },
      confidence: { geography: "approximate" },
      attributes: [
        { label: "Amenity", value: "marketplace" },
        { label: "Operator", value: "Municipal market board" },
        { label: "Opening hours", value: "Mo-Sa 08:00-20:00" },
      ],
    });
  });

  it("labels construction lifecycle tags without treating them as operational", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      elements: [{
        type: "node",
        id: 32,
        lat: 28.5,
        lon: 77.5,
        tags: {
          "construction:power": "substation",
          operator: "Recorded grid operator",
          voltage: "220000",
        },
      }],
    }), { status: 200 }));

    const result = await queryOverpassLayer(area, "utilities", fetchMock as typeof fetch);

    expect(result.features[0]).toMatchObject({
      status: "construction",
      attributes: [
        { label: "Construction power", value: "substation" },
        { label: "Operator", value: "Recorded grid operator" },
        { label: "Voltage", value: "220000" },
      ],
    });
  });

  it("retains a way that crosses a selected-area hole with an intersects label", async () => {
    const areaWithHole: AreaSelection = {
      ...area,
      geometry: {
        type: "Polygon",
        coordinates: [
          [[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]],
          [[77.4, 28.4], [77.6, 28.4], [77.6, 28.6], [77.4, 28.6], [77.4, 28.4]],
        ],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      elements: [{
        type: "way", id: 22, tags: { highway: "residential" },
        geometry: [{ lat: 28.5, lon: 77.2 }, { lat: 28.5, lon: 77.8 }],
      }],
    }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await queryOverpassLayer(areaWithHole, "roads");

    expect(result.features).toHaveLength(1);
    expect(result.features[0].containment).toBe("intersects");
  });

  it("marks an exact configured output cap as truncated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      elements: Array.from({ length: 1_000 }, (_, index) => ({
        type: "node",
        id: index + 1,
        lat: 28.5,
        lon: 77.5,
        tags: { highway: "residential" },
      })),
    }), { status: 200 }));

    const result = await queryOverpassLayer(area, "roads", fetchMock as typeof fetch);

    expect(result.truncated).toBe(true);
  });

  it("limits distinct live layer requests to two concurrent transports", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      setTimeout(() => {
        active -= 1;
        resolve(new Response(JSON.stringify({ elements: [] }), { status: 200 }));
      }, 10);
    }));

    await Promise.all([
      queryOverpassLayer(area, "transport", fetchMock as typeof fetch),
      queryOverpassLayer(area, "roads", fetchMock as typeof fetch),
      queryOverpassLayer(area, "healthcare", fetchMock as typeof fetch),
      queryOverpassLayer(area, "education", fetchMock as typeof fetch),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });

  it("caps streamed upstream bytes even without a Content-Length header", async () => {
    const response = new Response('{"elements":[{"id":1}]}');
    expect(response.headers.get("content-length")).toBeNull();

    await expect(readJsonWithByteLimit(response, 8)).rejects.toThrow("JSON body exceeds the safe size");
  });
});
