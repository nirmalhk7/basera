import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Point-in-polygon ray-casting algorithm
function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance helper (Haversine)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cache GeoJSON data in memory to make subsequent requests ultra-fast (sub-millisecond)
let cachedGeoJson: any = null;

function loadGeoJson() {
  if (cachedGeoJson) return cachedGeoJson;
  const filePath = path.join(process.cwd(), 'data', 'india_town_planner_jurisdictions.geojson');
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    cachedGeoJson = JSON.parse(raw);
    return cachedGeoJson;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: 'Missing lat or lng parameters' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Invalid lat or lng parameters' }, { status: 400 });
  }

  const geojson = loadGeoJson();
  if (!geojson) {
    return NextResponse.json({ error: 'Jurisdiction boundaries GeoJSON data not found' }, { status: 500 });
  }

  const point: [number, number] = [lng, lat]; // GeoJSON uses [longitude, latitude]
  let bestMatch: any = null;
  let minDistance = Infinity;

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'Polygon') {
      const coords = geom.coordinates;
      if (isPointInPolygon(point, coords[0])) {
        let insideHole = false;
        for (let h = 1; h < coords.length; h++) {
          if (isPointInPolygon(point, coords[h])) {
            insideHole = true;
            break;
          }
        }
        if (!insideHole) {
          bestMatch = feature;
          break; // Exact polygon match found!
        }
      }
    } else if (geom.type === 'MultiPolygon') {
      let matched = false;
      for (const polygon of geom.coordinates) {
        if (isPointInPolygon(point, polygon[0])) {
          let insideHole = false;
          for (let h = 1; h < polygon.length; h++) {
            if (isPointInPolygon(point, polygon[h])) {
              insideHole = true;
              break;
            }
          }
          if (!insideHole) {
            bestMatch = feature;
            matched = true;
            break;
          }
        }
      }
      if (matched) break; // Exact polygon match found!
    } else if (geom.type === 'Point') {
      const coords = geom.coordinates; // [lng, lat]
      const dist = getDistanceKm(lat, lng, coords[1], coords[0]);
      if (dist < 15 && dist < minDistance) {
        minDistance = dist;
        bestMatch = feature;
      }
    }
  }

  if (bestMatch) {
    return NextResponse.json({
      found: true,
      properties: bestMatch.properties,
      geometry: bestMatch.geometry
    });
  }

  return NextResponse.json({ found: false });
}
