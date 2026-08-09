import { NextResponse } from "next/server";
import { AreaReferenceError, createUserBoundaryReference } from "@/server/connectors/areaReferences";
import type { AreaGeometry } from "@/types/research";
import { validateEditableAreaGeometry } from "@/utils/researchGeometry";

const MAX_BODY_BYTES = 300_000;

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function anonymousRequestKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const source = forwarded || request.headers.get("x-real-ip") || request.headers.get("user-agent") || "anonymous";
  return source.slice(0, 512);
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Boundary request is too large." }, { status: 413 });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Boundary request is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Boundary request must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(payload) || !("geometry" in payload)) {
    return NextResponse.json({ error: "A Polygon or MultiPolygon geometry is required." }, { status: 400 });
  }

  const validation = validateEditableAreaGeometry(payload.geometry);
  if (!validation.valid) {
    return NextResponse.json({
      error: "Boundary geometry is not acceptable.",
      reason: validation.reason,
    }, { status: 400 });
  }

  const displayName = typeof payload.displayName === "string" ? payload.displayName : undefined;
  try {
    const created = await createUserBoundaryReference(payload.geometry as AreaGeometry, displayName, anonymousRequestKey(request));
    return NextResponse.json({ area: created.area, expiresAt: new Date(created.expiresAt).toISOString() }, { status: 201 });
  } catch (error) {
    if (error instanceof AreaReferenceError) {
      return NextResponse.json({ error: error.message }, {
        status: error.code === "infrastructure_unavailable" ? 503 : 429,
      });
    }
    return NextResponse.json({ error: "Boundary geometry is not acceptable." }, { status: 400 });
  }
}
