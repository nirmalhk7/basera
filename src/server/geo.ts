import type { AreaGeometry, BoundingBox, GeoPosition, ResearchGeometry } from "@/types/research";
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

export const isAreaGeometry = isValidAreaGeometry;

/** Retains the validated geometry members before passing data to storage or a renderer. */
export function canonicalAreaGeometry(geometry: AreaGeometry): AreaGeometry {
  return geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: geometry.coordinates }
    : { type: "MultiPolygon", coordinates: geometry.coordinates };
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

function pointOnAreaBoundary(point: Position, geometry: AreaGeometry): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => rings.some((ring) => {
    for (let index = 1; index < ring.length; index += 1) {
      if (onSegment(point, ring[index - 1], ring[index])) return true;
    }
    return false;
  }));
}

function areaBoundarySegments(geometry: AreaGeometry): Array<[Position, Position]> {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((rings) => rings.flatMap((ring) => {
    const segments: Array<[Position, Position]> = [];
    for (let index = 1; index < ring.length; index += 1) {
      segments.push([ring[index - 1], ring[index]]);
    }
    return segments;
  }));
}

function containmentForPositions(
  positions: readonly Position[],
  geometry: AreaGeometry,
  isClosed: boolean,
): "inside" | "intersects" | "outside" {
  const boundarySegments = areaBoundarySegments(geometry);
  const strictInside = positions.every((position) => isPointStrictlyInsideAreaGeometry(position, geometry));
  if (strictInside) {
    const segments = isClosed ? positions.map((position, index) => [
      position,
      positions[(index + 1) % positions.length],
    ] as [Position, Position]) : positions.slice(1).map((position, index) => [
      positions[index],
      position,
    ] as [Position, Position]);
    if (segments.some(([start, end]) =>
      boundarySegments.some(([boundaryStart, boundaryEnd]) =>
        segmentsIntersect(start, end, boundaryStart, boundaryEnd)))) {
      return "intersects";
    }
    return "inside";
  }

  const hasInteriorPosition = positions.some((position) =>
    isPointStrictlyInsideAreaGeometry(position, geometry));
  const hasBoundaryContact = positions.some((position) => pointOnAreaBoundary(position, geometry));
  const segments = isClosed ? positions.map((position, index) => [
    position,
    positions[(index + 1) % positions.length],
  ] as [Position, Position]) : positions.slice(1).map((position, index) => [
    positions[index],
    position,
  ] as [Position, Position]);
  const crossesBoundary = segments.some(([start, end]) =>
    boundarySegments.some(([boundaryStart, boundaryEnd]) =>
      segmentsIntersect(start, end, boundaryStart, boundaryEnd)));
  return hasInteriorPosition || hasBoundaryContact || crossesBoundary ? "intersects" : "outside";
}

function areaHasPositionInsideFeature(featureGeometry: AreaGeometry, areaGeometry: AreaGeometry): boolean {
  const areaPolygons = areaGeometry.type === "Polygon" ? [areaGeometry.coordinates] : areaGeometry.coordinates;
  return areaPolygons.some((rings) => rings[0].some((position) =>
    isPointStrictlyInsideAreaGeometry(position, featureGeometry)));
}

export function classifyGeometryContainment(
  geometry: ResearchGeometry,
  areaGeometry: AreaGeometry,
): "inside" | "intersects" | "outside" {
  if (geometry.type === "Point") {
    if (isPointStrictlyInsideAreaGeometry(geometry.coordinates, areaGeometry)) return "inside";
    return pointOnAreaBoundary(geometry.coordinates, areaGeometry) ? "intersects" : "outside";
  }
  if (geometry.type === "LineString") {
    return containmentForPositions(geometry.coordinates, areaGeometry, false);
  }
  if (geometry.type === "MultiLineString") {
    const results = geometry.coordinates.map((line) => containmentForPositions(line, areaGeometry, false));
    return results.includes("intersects") ? "intersects" : results.includes("inside") ? "inside" : "outside";
  }
  if (geometry.type === "Polygon") {
    const containment = containmentForPositions(geometry.coordinates[0], areaGeometry, true);
    return containment === "outside" && areaHasPositionInsideFeature(geometry, areaGeometry)
      ? "intersects"
      : containment;
  }
  const results = geometry.coordinates.map((polygon) => {
    const containment = containmentForPositions(polygon[0], areaGeometry, true);
    return containment === "outside" && areaHasPositionInsideFeature({ type: "Polygon", coordinates: polygon }, areaGeometry)
      ? "intersects"
      : containment;
  });
  return results.includes("intersects") ? "intersects" : results.includes("inside") ? "inside" : "outside";
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
