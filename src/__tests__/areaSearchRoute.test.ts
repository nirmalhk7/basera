import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/areas/search/route";
import { clearNominatimConnectorCacheForTests, resolveNominatimArea } from "@/server/connectors/nominatim";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  clearNominatimConnectorCacheForTests();
  vi.restoreAllMocks();
});

describe("GET /api/areas/search", () => {
  it("requests Nominatim only on submit and returns polygon area evidence with attribution", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        osm_type: "relation",
        osm_id: 1942586,
        display_name: "Bengaluru, Karnataka, India",
        address: { city: "Bengaluru", state: "Karnataka", county: "Bengaluru Urban", country_code: "in" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
      {
        osm_type: "node",
        osm_id: 1,
        display_name: "A point result that cannot define an area",
        address: { country_code: "in" },
        geojson: { type: "Point", coordinates: [77.6, 12.9] },
      },
    ]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=Bengaluru"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({ id: "osm:relation/1942586", name: "Bengaluru", state: "Karnataka" });
    expect(body.source).toMatchObject({ name: "OpenStreetMap Nominatim" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("countrycodes=in");
    expect(String(url)).toContain("polygon_geojson=1");
    expect(String(url)).toContain("bounded=1");
    expect(options.headers["User-Agent"]).toContain("Basera/");
  });

  it("rejects foreign and country-less polygon results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        osm_type: "relation",
        osm_id: 222,
        display_name: "Foreign District",
        address: { county: "Foreign District", country_code: "np" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
      {
        osm_type: "relation",
        osm_id: 223,
        display_name: "Country-less District",
        address: { county: "Country-less District" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
    ]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=District"));
    const body = await response.json();

    expect(body.results).toEqual([]);
  });

  it("single-flights and then caches an identical submit query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await Promise.all([
      GET(new NextRequest("http://localhost/api/areas/search?q=Kochi")),
      GET(new NextRequest("http://localhost/api/areas/search?q=Kochi")),
    ]);
    await GET(new NextRequest("http://localhost/api/areas/search?q=Kochi"));

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("resolves a searched area identity from the process cache without a lookup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        osm_type: "relation",
        osm_id: 1942586,
        display_name: "Bengaluru, Karnataka, India",
        address: { city: "Bengaluru", state: "Karnataka", country_code: "in" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
    ]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await GET(new NextRequest("http://localhost/api/areas/search?q=Bengaluru"));
    const area = await resolveNominatimArea("osm:relation/1942586");

    expect(area).toMatchObject({ id: "osm:relation/1942586", name: "Bengaluru" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses Nominatim lookup on an identity cache miss", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        osm_type: "way",
        osm_id: 12345,
        display_name: "Sample District, Karnataka, India",
        address: { county: "Sample District", state: "Karnataka", country_code: "in" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
    ]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const area = await resolveNominatimArea("osm:way/12345");

    expect(area).toMatchObject({ id: "osm:way/12345", name: "Sample District", countryCode: "in" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/lookup?");
    expect(String(fetchMock.mock.calls[0][0])).toContain("osm_ids=W12345");
    expect(String(fetchMock.mock.calls[0][0])).toContain("polygon_geojson=1");
  });

  it("uses the validated configured provider base for lookup", async () => {
    const originalBaseUrl = process.env.NOMINATIM_BASE_URL;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        osm_type: "relation",
        osm_id: 765,
        display_name: "Configured Provider District",
        address: { county: "Configured Provider District", country_code: "in" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
    ]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    process.env.NOMINATIM_BASE_URL = "https://nominatim.example.test/proxy/";

    try {
      await expect(resolveNominatimArea("osm:relation/765")).resolves.toMatchObject({ id: "osm:relation/765" });
      expect(String(fetchMock.mock.calls[0][0])).toContain("https://nominatim.example.test/proxy/lookup?");
    } finally {
      if (originalBaseUrl === undefined) delete process.env.NOMINATIM_BASE_URL;
      else process.env.NOMINATIM_BASE_URL = originalBaseUrl;
    }
  });

  it("rejects invalid area identities without a network request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(resolveNominatimArea("osm:relation/0")).resolves.toBeNull();
    await expect(resolveNominatimArea("osm:relation/12/extra")).resolves.toBeNull();
    await expect(resolveNominatimArea("osm:invalid/12")).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null for malformed or non-area lookup results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        osm_type: "relation",
        osm_id: 1942586,
        display_name: "A point cannot define an area",
        address: { country_code: "in" },
        geojson: { type: "Point", coordinates: [77.6, 12.9] },
      },
      {
        osm_type: "relation",
        osm_id: "not-a-positive-id",
        display_name: "Malformed area identity",
        address: { country_code: "in" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
      {
        osm_type: "relation",
        osm_id: 1942586,
        display_name: "Foreign area with a matching identity",
        address: { country_code: "np" },
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
      {
        osm_type: "relation",
        osm_id: 1942586,
        display_name: "Country-less area with a matching identity",
        address: {},
        geojson: {
          type: "Polygon",
          coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]],
        },
      },
    ]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await expect(resolveNominatimArea("osm:relation/1942586")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("briefly caches valid but unresolved area identities", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await expect(resolveNominatimArea("osm:relation/1942586")).resolves.toBeNull();
    await expect(resolveNominatimArea("osm:relation/1942586")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects an invalid query without a network request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=x"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fabricate results when Nominatim fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network unavailable")) as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=Pune"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ results: [], partial: true });
    expect(body.error).toContain("No fallback");
  });
});
