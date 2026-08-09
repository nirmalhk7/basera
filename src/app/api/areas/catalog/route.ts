import { NextResponse } from "next/server";
import { buildAreaCatalog } from "@/server/catalog";
import { resolveAreaReference } from "@/server/connectors/areaReferences";
import type { ResearchMode } from "@/types/research";

const AREA_ID_PATTERN = /^(?:osm:(?:relation|way)\/[1-9]\d*|user:boundary\/[0-9a-f-]{36})$/;

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const areaId = params.get("areaId")?.trim() ?? "";
  const mode = params.get("mode");
  if (!AREA_ID_PATTERN.test(areaId) || (mode !== "current" && mode !== "future")) {
    return NextResponse.json({ error: "areaId and mode=current|future are required." }, { status: 400 });
  }

  let area;
  try {
    area = await resolveAreaReference(areaId);
  } catch {
    return NextResponse.json({ error: "Area resolution failed. No fallback area was used." }, { status: 502 });
  }
  if (!area) return NextResponse.json({ error: "Area identity could not be resolved." }, { status: 404 });

  return NextResponse.json({
    area,
    mode: mode as ResearchMode,
    layers: await buildAreaCatalog(area, mode as ResearchMode),
    generatedAt: new Date().toISOString(),
  });
}
