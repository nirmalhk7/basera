import { describe, expect, it } from "vitest";
import {
  chooseBoundary,
  parseSearchIntent,
  type BoundaryCandidate,
  type BoundaryProvider,
} from "@/server/boundaries";
import { createNominatimBoundaryProvider } from "@/server/connectors/nominatim";
import type { AreaGeometry } from "@/types/research";

const geometry: AreaGeometry = {
  type: "Polygon",
  coordinates: [[[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]]],
};

function candidate(providerId: string, sourceType: "official" | "community" | "user", verified = false): BoundaryCandidate {
  return {
    id: `${providerId}:area/1`,
    providerId,
    name: "Test area",
    displayName: "Test area, India",
    kind: "locality",
    countryCode: "in",
    source: { name: providerId, url: "https://example.test/source" },
    boundary: { sourceType, confidence: "medium", editable: sourceType !== "official" },
    geometry,
    originalGeometry: geometry,
    bbox: [77, 28, 78, 29],
    verified,
    confirmationRequired: true,
  };
}

describe("boundary provider contract", () => {
  it("selects a compatible official boundary ahead of verified OSM and user correction", () => {
    const result = chooseBoundary([
      { providerId: "municipal", candidate: candidate("municipal", "official"), compatible: true },
      { providerId: "nominatim", candidate: candidate("nominatim", "community", true), compatible: true },
      { providerId: "user", candidate: candidate("user", "user"), compatible: true },
    ]);

    expect(result.winner?.providerId).toBe("municipal");
    expect(result.winnerReason).toBe("compatible_official_boundary");
    expect(result.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: "nominatim", reason: "lower_precedence" }),
      expect.objectContaining({ providerId: "user", reason: "lower_precedence" }),
    ]));
  });

  it("falls back to verified OSM when official data is stale or incompatible", () => {
    const result = chooseBoundary([
      { providerId: "municipal", candidate: candidate("municipal", "official"), compatible: false, failure: "stale_source" },
      { providerId: "nominatim", candidate: candidate("nominatim", "community", true), compatible: true },
    ]);

    expect(result.winner?.providerId).toBe("nominatim");
    expect(result.winnerReason).toBe("verified_osm_boundary");
    expect(result.alternatives).toContainEqual({ providerId: "municipal", reason: "stale_source" });
  });

  it("uses user correction only after official and verified OSM candidates fail", () => {
    const result = chooseBoundary([
      { providerId: "municipal", candidate: candidate("municipal", "official"), compatible: false, failure: "invalid_geometry" },
      { providerId: "nominatim", candidate: candidate("nominatim", "community"), compatible: true },
      { providerId: "user", candidate: candidate("user", "user"), compatible: true },
    ]);

    expect(result.winner?.providerId).toBe("user");
    expect(result.winnerReason).toBe("user_correction");
    expect(result.alternatives).toEqual(expect.arrayContaining([
      { providerId: "municipal", reason: "invalid_geometry" },
      { providerId: "nominatim", reason: "unverified_osm_boundary" },
    ]));
  });

  it("reports malformed provider geometry as an alternative failure", () => {
    const malformed = { ...candidate("municipal", "official"), geometry: { type: "Polygon", coordinates: [] } as AreaGeometry };
    const result = chooseBoundary([
      { providerId: "municipal", candidate: malformed, compatible: true },
      { providerId: "user", candidate: candidate("user", "user"), compatible: true },
    ]);

    expect(result.winner?.providerId).toBe("user");
    expect(result.alternatives).toContainEqual({ providerId: "municipal", reason: "invalid_geometry" });
  });

  it("normalizes Unicode before classifying a supported locality query", () => {
    const intent = parseSearchIntent("  Cafe\u0301  ");

    expect(intent).toMatchObject({ valid: true, query: "Café", kind: "locality" });
  });

  it("rejects an empty normalized query", () => {
    expect(parseSearchIntent("  \u00a0 ")).toMatchObject({ valid: false, code: "empty_query" });
  });

  it("rejects a query longer than the contract limit", () => {
    expect(parseSearchIntent("x".repeat(161))).toMatchObject({ valid: false, code: "query_too_long" });
  });

  it("rejects coordinate queries outside India before a provider is selected", () => {
    const intent = parseSearchIntent("40.7128, -74.0060", "coordinates");

    expect(intent).toMatchObject({ valid: false, code: "coordinates_outside_india" });
  });

  it("describes unsupported provider forms instead of treating them as generic free text", () => {
    const provider: BoundaryProvider = {
      metadata: {
        id: "official-slot",
        name: "Official planning source",
        provenance: "official",
        authority: "Municipal or planning authority",
        termsUrl: "https://example.test/terms",
        health: "unconfigured",
        supportedSearchKinds: ["ward"],
      },
      search: async () => [],
      resolve: async () => null,
    };

    expect(provider.metadata.supportedSearchKinds).not.toContain("project");
  });

  it("adapts Nominatim community results into confirmable, verified boundary candidates", async () => {
    const fetcher = async () => new Response(JSON.stringify([{
      osm_type: "relation",
      osm_id: 1942586,
      display_name: "Bengaluru, Karnataka, India",
      address: { city: "Bengaluru", state: "Karnataka", country_code: "in" },
      geojson: geometry,
    }]), { status: 200 });
    const provider = createNominatimBoundaryProvider(fetcher as typeof fetch);
    const intent = parseSearchIntent("Bengaluru");
    if (!intent.valid) throw new Error("test setup expects valid intent");

    const results = await provider.search(intent);

    expect(provider.metadata).toMatchObject({ provenance: "community", health: "unknown" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "nominatim",
      kind: "locality",
      verified: true,
      confirmationRequired: true,
      originalGeometry: geometry,
    });
  });
});
