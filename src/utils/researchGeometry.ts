import type { AreaGeometry, BoundingBox, GeoPosition, LinearRing, PolygonGeometry } from '@/types/research';

const MINIMUM_RING_POSITIONS = 4;

function coordinatesMatch(first: GeoPosition, second: GeoPosition): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function isFinitePosition(position: GeoPosition): boolean {
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

export function isValidLinearRing(ring: LinearRing): boolean {
  if (ring.length < MINIMUM_RING_POSITIONS) {
    return false;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  return ring.every(isFinitePosition) && coordinatesMatch(first, last) && ringHasArea(ring);
}

function isValidPolygon(polygon: PolygonGeometry): boolean {
  return polygon.coordinates.length > 0 && polygon.coordinates.every(isValidLinearRing);
}

export function isValidAreaGeometry(geometry: AreaGeometry): boolean {
  if (geometry.type === 'Polygon') {
    return isValidPolygon(geometry);
  }

  return geometry.coordinates.length > 0 && geometry.coordinates.every((coordinates) =>
    isValidPolygon({ type: 'Polygon', coordinates }),
  );
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
