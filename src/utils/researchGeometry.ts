import type {
  AreaGeometry,
  BoundingBox,
  GeoPosition,
  LinearRing,
  PolygonGeometry,
} from '@/types/research';

const MINIMUM_RING_POSITIONS = 4;
const INDIA_BOUNDS: BoundingBox = [68.1, 6, 97.5, 37.1];
const MAX_EDITABLE_VERTICES = 5_000;
const MAX_EDITABLE_BBOX_SPAN = 5;

function coordinatesMatch(first: GeoPosition, second: GeoPosition): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function isFinitePosition(position: unknown): position is GeoPosition {
  if (!Array.isArray(position) || position.length < 2 || position.length > 3 ||
      (position.length === 3 && !Number.isFinite(position[2]))) return false;
  const [longitude, latitude] = position;
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function ringHasArea(ring: LinearRing): boolean {
  let twiceArea = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [nextLongitude, nextLatitude] = ring[index + 1];
    twiceArea += currentLongitude * nextLatitude - nextLongitude * currentLatitude;
  }

  return twiceArea !== 0;
}

function orientation(start: GeoPosition, end: GeoPosition, point: GeoPosition): number {
  return (end[0] - start[0]) * (point[1] - start[1]) -
    (end[1] - start[1]) * (point[0] - start[0]);
}

function onSegment(point: GeoPosition, start: GeoPosition, end: GeoPosition): boolean {
  const epsilon = 1e-10;
  return Math.abs(orientation(start, end, point)) <= epsilon &&
    point[0] >= Math.min(start[0], end[0]) - epsilon &&
    point[0] <= Math.max(start[0], end[0]) + epsilon &&
    point[1] >= Math.min(start[1], end[1]) - epsilon &&
    point[1] <= Math.max(start[1], end[1]) + epsilon;
}

function segmentsIntersect(
  firstStart: GeoPosition,
  firstEnd: GeoPosition,
  secondStart: GeoPosition,
  secondEnd: GeoPosition,
): boolean {
  const first = orientation(firstStart, firstEnd, secondStart);
  const second = orientation(firstStart, firstEnd, secondEnd);
  const third = orientation(secondStart, secondEnd, firstStart);
  const fourth = orientation(secondStart, secondEnd, firstEnd);

  if (onSegment(secondStart, firstStart, firstEnd) ||
      onSegment(secondEnd, firstStart, firstEnd) ||
      onSegment(firstStart, secondStart, secondEnd) ||
      onSegment(firstEnd, secondStart, secondEnd)) {
    return true;
  }
  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
}

function ringHasSelfIntersection(ring: LinearRing): boolean {
  for (let first = 0; first < ring.length - 1; first += 1) {
    for (let second = first + 1; second < ring.length - 1; second += 1) {
      if (second === first + 1 || (first === 0 && second === ring.length - 2)) continue;
      if (segmentsIntersect(ring[first], ring[first + 1], ring[second], ring[second + 1])) return true;
    }
  }
  return false;
}

function isClosedLinearRing(ring: LinearRing): boolean {
  return Array.isArray(ring) && ring.length >= MINIMUM_RING_POSITIONS &&
    ring.every(isFinitePosition) && coordinatesMatch(ring[0], ring[ring.length - 1]);
}

export function isValidLinearRing(ring: LinearRing): boolean {
  return isClosedLinearRing(ring) && ringHasArea(ring);
}

function hasValidAreaGeometryShape(value: unknown): value is AreaGeometry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { type, coordinates } = value as Partial<AreaGeometry>;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  if (type === 'Polygon') return coordinates.every(isClosedLinearRing);
  return type === 'MultiPolygon' && coordinates.every((polygon) =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(isClosedLinearRing));
}

export function isValidAreaGeometry(geometry: unknown): geometry is AreaGeometry {
  if (!hasValidAreaGeometryShape(geometry)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.every((polygon) => polygon.every(ringHasArea));
}

export function getAreaGeometryBounds(geometry: AreaGeometry): BoundingBox | null {
  if (!isValidAreaGeometry(geometry)) {
    return null;
  }

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let minimumLongitude = Number.POSITIVE_INFINITY;
  let minimumLatitude = Number.POSITIVE_INFINITY;
  let maximumLongitude = Number.NEGATIVE_INFINITY;
  let maximumLatitude = Number.NEGATIVE_INFINITY;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        minimumLongitude = Math.min(minimumLongitude, longitude);
        minimumLatitude = Math.min(minimumLatitude, latitude);
        maximumLongitude = Math.max(maximumLongitude, longitude);
        maximumLatitude = Math.max(maximumLatitude, latitude);
      }
    }
  }

  return [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude];
}

function vertexCount(geometry: AreaGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((total, polygon) =>
    total + polygon.reduce((polygonTotal, ring) => polygonTotal + ring.length, 0), 0);
}

export type EditableGeometryValidation =
  | { readonly valid: true; readonly bbox: BoundingBox; readonly vertexCount: number }
  | { readonly valid: false; readonly reason: 'invalid-geometry' | 'self-intersection' | 'outside-india' | 'too-many-vertices' | 'too-large' };

export function validateEditableAreaGeometry(value: unknown): EditableGeometryValidation {
  if (!hasValidAreaGeometryShape(value)) return { valid: false, reason: 'invalid-geometry' };
  const count = vertexCount(value);
  if (count > MAX_EDITABLE_VERTICES) return { valid: false, reason: 'too-many-vertices' };
  const polygons = value.type === 'Polygon' ? [value.coordinates] : value.coordinates;
  if (polygons.some((polygon) => polygon.some((ring) => ringHasSelfIntersection(ring)))) {
    return { valid: false, reason: 'self-intersection' };
  }
  const bbox = getAreaGeometryBounds(value);
  if (!bbox) return { valid: false, reason: 'invalid-geometry' };
  if (
    bbox[0] < INDIA_BOUNDS[0] ||
    bbox[1] < INDIA_BOUNDS[1] ||
    bbox[2] > INDIA_BOUNDS[2] ||
    bbox[3] > INDIA_BOUNDS[3]
  ) {
    return { valid: false, reason: 'outside-india' };
  }
  if (bbox[2] - bbox[0] > MAX_EDITABLE_BBOX_SPAN || bbox[3] - bbox[1] > MAX_EDITABLE_BBOX_SPAN) {
    return { valid: false, reason: 'too-large' };
  }
  return { valid: true, bbox, vertexCount: count };
}

function isPointOnSegment(point: GeoPosition, start: GeoPosition, end: GeoPosition): boolean {
  const [pointLongitude, pointLatitude] = point;
  const [startLongitude, startLatitude] = start;
  const [endLongitude, endLatitude] = end;
  const crossProduct =
    (pointLatitude - startLatitude) * (endLongitude - startLongitude) -
    (pointLongitude - startLongitude) * (endLatitude - startLatitude);

  if (crossProduct !== 0) {
    return false;
  }

  return (
    pointLongitude >= Math.min(startLongitude, endLongitude) &&
    pointLongitude <= Math.max(startLongitude, endLongitude) &&
    pointLatitude >= Math.min(startLatitude, endLatitude) &&
    pointLatitude <= Math.max(startLatitude, endLatitude)
  );
}

function isPointOnLinearRing(point: GeoPosition, ring: LinearRing): boolean {
  for (let index = 0; index < ring.length - 1; index += 1) {
    if (isPointOnSegment(point, ring[index], ring[index + 1])) {
      return true;
    }
  }

  return false;
}

function isPointStrictlyInsideRing(point: GeoPosition, ring: LinearRing): boolean {
  let isInside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (isPointOnSegment(point, previous, current)) {
      return false;
    }

    const crossesLatitude = (current[1] > point[1]) !== (previous[1] > point[1]);
    if (crossesLatitude) {
      const longitudeAtCrossing =
        ((previous[0] - current[0]) * (point[1] - current[1])) / (previous[1] - current[1]) + current[0];

      if (point[0] < longitudeAtCrossing) {
        isInside = !isInside;
      }
    }
  }

  return isInside;
}

function isPointStrictlyInsidePolygon(point: GeoPosition, polygon: PolygonGeometry): boolean {
  const [outerRing, ...holes] = polygon.coordinates;

  if (!outerRing || !isPointStrictlyInsideRing(point, outerRing)) {
    return false;
  }

  return holes.every(
    (hole) => !isPointOnLinearRing(point, hole) && !isPointStrictlyInsideRing(point, hole),
  );
}

export function isPointStrictlyInsideAreaGeometry(point: GeoPosition, geometry: AreaGeometry): boolean {
  if (!isFinitePosition(point) || !isValidAreaGeometry(geometry)) {
    return false;
  }

  if (geometry.type === 'Polygon') {
    return isPointStrictlyInsidePolygon(point, geometry);
  }

  return geometry.coordinates.some((coordinates) =>
    isPointStrictlyInsidePolygon(point, { type: 'Polygon', coordinates }),
  );
}
