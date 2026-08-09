import { NextRequest, NextResponse } from "next/server";
import { parseSearchIntent } from "@/server/boundaries";
import { createNominatimBoundaryProvider } from "@/server/connectors/nominatim";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" };

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const intent = parseSearchIntent(params.get("q"), params.get("kind"));
  if (!intent.valid) {
    return NextResponse.json(
      { error: intent.error, code: intent.code },
      { status: 400, headers: CACHE_HEADERS },
    );
  }

  const provider = createNominatimBoundaryProvider();
  const supported = provider.metadata.supportedSearchKinds.includes(intent.kind);
  const providerSupport = [{ providerId: provider.metadata.id, supported }];
  if (!supported) {
    return NextResponse.json({
      error: `No configured boundary provider supports ${intent.kind} searches.`,
      code: "unsupported_search_kind",
      kind: intent.kind,
      providerSupport,
    }, { status: 422, headers: CACHE_HEADERS });
  }

  try {
    const results = await provider.search(intent);
    return NextResponse.json(
      {
        intent: { query: intent.query, kind: intent.kind },
        providerSupport,
        providers: [provider.metadata],
        results,
        source: {
          name: "OpenStreetMap Nominatim",
          url: "https://nominatim.openstreetmap.org/",
          attribution: "Search data © OpenStreetMap contributors, via Nominatim",
        },
        partial: false,
      },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    console.error("Area search request failed", error);
    return NextResponse.json(
      {
        results: [],
        source: {
          name: "OpenStreetMap Nominatim",
          url: "https://nominatim.openstreetmap.org/",
          attribution: "Search data © OpenStreetMap contributors, via Nominatim",
        },
        intent: { query: intent.query, kind: intent.kind },
        providerSupport,
        providers: [provider.metadata],
        partial: true,
        error: "The live area search service did not return a response. No fallback results were generated.",
      },
      { status: 502, headers: CACHE_HEADERS },
    );
  }
}
