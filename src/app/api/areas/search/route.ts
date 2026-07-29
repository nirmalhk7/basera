import { NextRequest, NextResponse } from "next/server";
import { searchNominatimAreas } from "@/server/connectors/nominatim";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 160;
const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" };

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `q must contain ${MIN_QUERY_LENGTH} to ${MAX_QUERY_LENGTH} characters.` },
      { status: 400, headers: CACHE_HEADERS },
    );
  }

  try {
    const result = await searchNominatimAreas(query);
    return NextResponse.json(
      { results: result.areas, source: result.source, partial: false },
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
        partial: true,
        error: "The live area search service did not return a response. No fallback results were generated.",
      },
      { status: 502, headers: CACHE_HEADERS },
    );
  }
}
