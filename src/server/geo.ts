import type { AreaGeometry, BoundingBox, GeoPosition } from "@/types/research";
import {
  getAreaGeometryBounds,
  isPointStrictlyInsideAreaGeometry,
  isValidAreaGeometry,
} from "@/utils/researchGeometry";

export type Position = GeoPosition;
export type Bbox = BoundingBox;

export const INDIA_BBOX: Bbox = [68.1, 6.0, 97.5, 37.1];

export function isFinitePosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
    typeof value[1] === "number" && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90;
}

/** Safely narrows untrusted JSON, then delegates semantic ring validation to shared geometry utilities. */
export function isAreaGeometry(value: unknown): value is AreaGeometry {
  if (!value || typeof value !== "object") return false;
  try {
    return isValidAreaGeometry(value as AreaGeometry);
  } catch {
    return false;
  }
}

export function isValidBbox(value: unknown): value is Bbox {
  return Array.isArray(value) && value.length === 4 && value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) &&
    value[0] >= -180 && value[2] <= 180 && value[1] >= -90 && value[3] <= 90 &&
    value[0] < value[2] && value[1] < value[3];
}

export function bboxForGeometry(geometry: AreaGeometry): Bbox {
  const bounds = getAreaGeometryBounds(geometry);
  if (!bounds) throw new Error("Area geometry has no valid bounds");
  return bounds;
}

export function bboxMatchesGeometry(bbox: Bbox, geometry: AreaGeometry): boolean {
  const expected = getAreaGeometryBounds(geometry);
  const tolerance = 1e-9;
  return expected !== null && expected.every((coordinate, index) => Math.abs(coordinate - bbox[index]) <= tolerance);
}

function orientation(start: Position, end: Position, point: Position): number {
  return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0]);
}

function onSegment(point: Position, start: Position, end: Position): boolean {
  const epsilon = 1e-12;
  return Math.abs(orientation(start, end, point)) <= epsilon &&
    point[0] >= Math.min(start[0], end[0]) - epsilon && point[0] <= Math.max(start[0], end[0]) + epsilon &&
    point[1] >= Math.min(start[1], end[1]) - epsilon && point[1] <= Math.max(start[1], end[1]) + epsilon;
}

/** Boundary contact counts as an intersection: output geometry must remain strictly inside. */
function segmentsIntersect(firstStart: Position, firstEnd: Position, secondStart: Position, secondEnd: Position): boolean {
  const epsilon = 1e-12;
  const first = orientation(firstStart, firstEnd, secondStart);
  const second = orientation(firstStart, firstEnd, secondEnd);
  const third = orientation(secondStart, secondEnd, firstStart);
  const fourth = orientation(secondStart, secondEnd, firstEnd);
  if (Math.abs(first) <= epsilon && onSegment(secondStart, firstStart, firstEnd)) return true;
  if (Math.abs(second) <= epsilon && onSegment(secondEnd, firstStart, firstEnd)) return true;
  if (Math.abs(third) <= epsilon && onSegment(firstStart, secondStart, secondEnd)) return true;
  if (Math.abs(fourth) <= epsilon && onSegment(firstEnd, secondStart, secondEnd)) return true;
  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
}

function segmentIsStrictlyInsidePolygon(start: Position, end: Position, rings: readonly (readonly Position[])[]): boolean {
  if (!isPointStrictlyInsideAreaGeometry(start, { type: "Polygon", coordinates: rings }) ||
      !isPointStrictlyInsideAreaGeometry(end, { type: "Polygon", coordinates: rings })) return false;
  if (start[0] === end[0] && start[1] === end[1]) return true;
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      if (segmentsIntersect(start, end, ring[index - 1], ring[index])) return false;
    }
  }
  return true;
}

function segmentIsStrictlyInsideArea(start: Position, end: Position, geometry: AreaGeometry): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => segmentIsStrictlyInsidePolygon(start, end, rings));
}

/** Proves every vertex and straight segment strictly inside one selected polygon component. */
export function positionsAndSegmentsStrictlyInside(positions: readonly Position[], geometry: AreaGeometry): boolean {
  if (positions.length === 0 || !positions.every((position) => isPointStrictlyInsideAreaGeometry(position, geometry))) return false;
  for (let index = 1; index < positions.length; index += 1) {
    if (!segmentIsStrictlyInsideArea(positions[index - 1], positions[index], geometry)) return false;
  }
  return true;
}
