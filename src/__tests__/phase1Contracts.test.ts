import { describe, expect, it } from 'vitest';
import { POST as createBoundary } from '@/app/api/areas/boundary/route';
import { GET as getCatalog } from '@/app/api/areas/catalog/route';
import { buildAreaCatalog } from '@/server/catalog';
import { classifyGeometryContainment } from '@/server/geo';
import type { AreaGeometry, AreaSelection, ResearchGeometry } from '@/types/research';
import { validateEditableAreaGeometry } from '@/utils/researchGeometry';

const area: AreaSelection = {
  id: 'osm:relation/1',
  name: 'Test area',
  displayName: 'Test area, India',
  countryCode: 'in',
  source: { name: 'OpenStreetMap Nominatim', url: 'https://www.openstreetmap.org/relation/1' },
  geometry: {
    type: 'Polygon',
    coordinates: [[[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]]],
  },
  bbox: [77, 28, 78, 29],
};

const square: AreaGeometry = {
  type: 'Polygon',
  coordinates: [[[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]]],
};

function request(body: unknown): Request {
  return new Request('http://localhost/api/areas/boundary', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Phase 1 contracts', () => {
  it('accepts a finite, closed India polygon and rejects a self-intersecting polygon', () => {
    expect(validateEditableAreaGeometry(square)).toMatchObject({ valid: true, vertexCount: 5 });
    expect(validateEditableAreaGeometry({
      type: 'Polygon',
      coordinates: [[[77, 28], [78, 29], [78, 28], [77, 29], [77, 28]]],
    })).toMatchObject({ valid: false, reason: 'self-intersection' });
  });

  it('labels crossing lines and polygons as intersects while excluding outside geometry', () => {
    const crossingLine: ResearchGeometry = {
      type: 'LineString',
      coordinates: [[76.5, 28.5], [77.5, 28.5]],
    };
    const crossingPolygon: ResearchGeometry = {
      type: 'Polygon',
      coordinates: [[[76.5, 28.5], [77.5, 28.5], [77.5, 29.5], [76.5, 29.5], [76.5, 28.5]]],
    };
    const outsidePoint: ResearchGeometry = { type: 'Point', coordinates: [76.5, 28.5] };

    expect(classifyGeometryContainment(crossingLine, square)).toBe('intersects');
    expect(classifyGeometryContainment(crossingPolygon, square)).toBe('intersects');
    expect(classifyGeometryContainment(outsidePoint, square)).toBe('outside');
  });

  it('labels a polygon that encloses the selected area as intersects', () => {
    const enclosingPolygon: ResearchGeometry = {
      type: 'Polygon',
      coordinates: [[[76, 27], [79, 27], [79, 30], [76, 30], [76, 27]]],
    };

    expect(classifyGeometryContainment(enclosingPolygon, square)).toBe('intersects');
  });

  it('builds a per-area catalog with canonical availability states', async () => {
    const current = await buildAreaCatalog(area, 'current');
    const future = await buildAreaCatalog(area, 'future');

    expect(current.find((entry) => entry.layerId === 'roads')).toMatchObject({
      availability: 'available',
      providers: [{ name: 'OpenStreetMap' }],
      sourceHealth: 'healthy',
    });
    expect(future.find((entry) => entry.layerId === 'government_plans')).toMatchObject({
      availability: 'unavailable',
      limitation: expect.stringContaining('adapter'),
    });
  });

  it('reports configured provider health and age for a queryable current layer', async () => {
    const catalog = await buildAreaCatalog(area, 'current');
    const roads = catalog.find((entry) => entry.layerId === 'roads');

    expect(roads).toMatchObject({
      availability: 'available',
      sourceHealth: 'healthy',
      providers: [expect.objectContaining({ name: 'OpenStreetMap' })],
    });
    expect(roads?.limitation).toContain('community-sourced');
    expect(roads?.sourceAge).toMatch(/^PT\d+S$/);
  });

  it('creates a short-lived user boundary reference without a profile or permanent store', async () => {
    const response = await createBoundary(request({
      displayName: 'Edited test area',
      geometry: square,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.area).toMatchObject({
      displayName: 'Edited test area',
      geometry: square,
      boundary: {
        sourceType: 'user',
        confidence: 'low',
        editable: true,
      },
    });
    expect(body.area.id).toMatch(/^user:boundary\//);

    const catalogResponse = await getCatalog(new Request(
      'http://localhost/api/areas/catalog?areaId=' + encodeURIComponent(body.area.id) + '&mode=current',
    ));
    const catalogBody = await catalogResponse.json();
    expect(catalogResponse.status).toBe(200);
    expect(catalogBody.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ layerId: 'roads', availability: 'available' }),
    ]));
  });
});
