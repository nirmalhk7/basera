import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../app/api/jurisdiction/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  }
}));

describe('/api/jurisdiction Route Handler', () => {
  const dummyGeoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [72.8, 18.9],
              [73.0, 18.9],
              [73.0, 19.1],
              [72.8, 19.1],
              [72.8, 18.9]
            ]
          ]
        },
        properties: {
          name_en: 'Mumbai Jurisdiction',
          planning_authority: 'Mumbai Metropolitan Region Development Authority',
          website: 'https://mmrda.maharashtra.gov.in',
          place_type: 'city'
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [77.2, 28.6] // [lng, lat]
        },
        properties: {
          name_en: 'Delhi Point Jurisdiction',
          planning_authority: 'Delhi Development Authority',
          website: 'https://dda.gov.in',
          place_type: 'city'
        }
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return matched jurisdiction properties for coordinates inside the polygon boundary', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify(dummyGeoJson));

    // Point [72.9, 19.0] is inside the Polygon [[72.8, 18.9], ..., [72.8, 18.9]]
    const req = new NextRequest('http://localhost/api/jurisdiction?lat=19.0&lng=72.9');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toBe(true);
    expect(data.properties.name_en).toBe('Mumbai Jurisdiction');
    expect(data.properties.planning_authority).toBe('Mumbai Metropolitan Region Development Authority');
    expect(data.properties.planning_documents).toBeDefined();
    expect(Array.isArray(data.properties.planning_documents)).toBe(true);
    expect(data.properties.state_planning_portal).toBeDefined();
    expect(data.properties.search_documents_url).toContain('google.com/search');
    expect(data.properties.search_documents_ddg_url).toContain('duckduckgo.com');
  });

  it('should match nearest Point jurisdiction if coordinate is within 15km and no polygon matches', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify(dummyGeoJson));

    // Coordinates [28.61, 77.21] are extremely close to the point [28.6, 77.2] (~1.5 km)
    const req = new NextRequest('http://localhost/api/jurisdiction?lat=28.61&lng=77.21');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toBe(true);
    expect(data.properties.name_en).toBe('Delhi Point Jurisdiction');
  });

  it('should return found: false if coordinates are outside any polygon or point range', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify(dummyGeoJson));

    // [10.0, 70.0] is far away from both Pune and Delhi
    const req = new NextRequest('http://localhost/api/jurisdiction?lat=10.0&lng=70.0');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toBe(false);
  });

  it('should return 400 bad request if parameters are missing or invalid', async () => {
    const req = new NextRequest('http://localhost/api/jurisdiction?lat=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
