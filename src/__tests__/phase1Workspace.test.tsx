import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AreaSelection, ResearchFeature } from '@/types/research';

vi.mock('next/dynamic', () => ({
  default: () => function ResearchMapMock({
    area,
    isEditingBoundary,
    onBoundaryPoint,
    onFinishBoundary,
    onCancelBoundary,
  }: {
    area: AreaSelection | null;
    features: readonly ResearchFeature[];
    isEditingBoundary: boolean;
    onBoundaryPoint: (point: readonly [number, number]) => void;
    onFinishBoundary: () => void;
    onCancelBoundary: () => void;
  }) {
    return (
      <>
        <p aria-label="Mapped boundary">{area?.id ?? 'No mapped boundary'}</p>
        {isEditingBoundary ? (
          <>
            <button type="button" onClick={() => onBoundaryPoint([77.2, 28.2])}>Add first boundary point</button>
            <button type="button" onClick={() => onBoundaryPoint([77.8, 28.2])}>Add second boundary point</button>
            <button type="button" onClick={() => onBoundaryPoint([77.8, 28.8])}>Add third boundary point</button>
            <button type="button" onClick={onFinishBoundary}>Finish boundary</button>
            <button type="button" onClick={onCancelBoundary}>Cancel boundary</button>
          </>
        ) : null}
      </>
    );
  },
}));

import { ResearchWorkspace } from '@/components/research/ResearchWorkspace';

const area: AreaSelection = {
  id: 'osm:relation/123',
  name: 'Pune',
  displayName: 'Pune, Maharashtra, India',
  countryCode: 'in',
  source: { name: 'Nominatim', url: 'https://nominatim.openstreetmap.org/' },
  boundary: { sourceType: 'community', confidence: 'medium', editable: true },
  geometry: { type: 'Polygon', coordinates: [[[73.7, 18.4], [73.9, 18.4], [73.9, 18.6], [73.7, 18.4]]] },
  bbox: [73.7, 18.4, 73.9, 18.6],
};

const editedArea: AreaSelection = {
  ...area,
  id: 'user:boundary/00000000-0000-4000-8000-000000000001',
  displayName: 'Edited Pune boundary',
  boundary: { sourceType: 'user', confidence: 'low', editable: true },
  geometry: { type: 'Polygon', coordinates: [[[77.2, 28.2], [77.8, 28.2], [77.8, 28.8], [77.2, 28.2]]] },
  bbox: [77.2, 28.2, 77.8, 28.8],
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Phase 1 workspace boundary flow', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends the selected search kind to the area search route', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [area] }));

    render(<ResearchWorkspace />);
    fireEvent.change(screen.getByLabelText('Search kind'), { target: { value: 'ward' } });
    fireEvent.change(screen.getByLabelText('Search for an area'), { target: { value: 'Ward 12, Pune' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText(area.displayName);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(request.pathname).toBe('/api/areas/search');
    expect(Object.fromEntries(request.searchParams)).toEqual({ q: 'Ward 12, Pune', kind: 'ward' });
  });

  it('loads the area catalog and replaces the confirmed boundary after a user edit', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [area] }))
      .mockResolvedValueOnce(jsonResponse({
        area,
        mode: 'current',
        layers: [{
          layerId: 'roads',
          availability: 'partial',
          providers: [{ name: 'OpenStreetMap' }],
          checkedAt: '2026-08-04T12:00:00.000Z',
          sourceHealth: 'unknown',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ area: editedArea, expiresAt: '2026-08-04T12:15:00.000Z' }, 201));

    render(<ResearchWorkspace />);
    fireEvent.change(screen.getByLabelText('Search for an area'), { target: { value: 'Pune' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText(area.displayName);
    fireEvent.click(screen.getByRole('button', { name: area.displayName }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm area' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/areas/catalog?areaId=${encodeURIComponent(area.id)}&mode=current`,
      expect.anything(),
    ));
    expect(screen.getByText(/Community boundary/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit boundary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add first boundary point' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add second boundary point' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add third boundary point' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish boundary' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/areas/boundary',
      expect.objectContaining({ method: 'POST' }),
    ));
    const boundaryRequest = fetchMock.mock.calls.find(([url]) => url === '/api/areas/boundary')?.[1];
    expect(JSON.parse(boundaryRequest.body)).toMatchObject({
      geometry: {
        type: 'Polygon',
        coordinates: [[[77.2, 28.2], [77.8, 28.2], [77.8, 28.8], [77.2, 28.2]]],
      },
    });
    await screen.findByText(/User-drawn boundary/);
    expect(screen.getByLabelText('Mapped boundary')).toHaveTextContent(editedArea.id);
  });
});
