import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/areas/search/route";
import { clearNominatimConnectorCacheForTests } from "@/server/connectors/nominatim";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  clearNominatimConnectorCacheForTests();
  vi.restoreAllMocks();
});

describe("GET /api/areas/search intent contract", () => {
  it("returns normalized candidate type and provider support for an explicit locality request", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      osm_type: "relation",
      osm_id: 1942586,
      display_name: "Bengaluru, Karnataka, India",
      address: { city: "Bengaluru", state: "Karnataka", country_code: "in" },
      geojson: { type: "Polygon", coordinates: [[[77.5, 12.8], [77.7, 12.8], [77.7, 13.1], [77.5, 12.8]]] },
    }]), { status: 200 })) as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=Bengaluru&kind=locality"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.intent).toEqual({ kind: "locality", query: "Bengaluru" });
    expect(body.providerSupport).toEqual([{ providerId: "nominatim", supported: true }]);
    expect(body.results[0]).toMatchObject({ kind: "locality", providerId: "nominatim", confirmationRequired: true });
  });

  it("rejects out-of-India coordinates before contacting a provider", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=40.7128,-74.0060&kind=coordinates"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: "coordinates_outside_india" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes an unsupported coordinate resolver explicit instead of free-text fallback", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/areas/search?q=28.6139,77.2090&kind=coordinates"));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({ code: "unsupported_search_kind", kind: "coordinates" });
    expect(body.providerSupport).toEqual([{ providerId: "nominatim", supported: false }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
