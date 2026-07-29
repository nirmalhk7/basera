import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AreaSelection, LayerQueryResponse, ResearchFeature } from '@/types/research';

vi.mock('next/dynamic', () => ({
  default: () => function ResearchMapMock({ area: mappedArea, features, onSelectFeature }: { area: AreaSelection | null; features: readonly ResearchFeature[]; onSelectFeature: (feature: ResearchFeature) => void }) {
    return (
      <>
        <p aria-label="Mapped boundary">{mappedArea ? `${mappedArea.id}: ${mappedArea.bbox.join(',')}` : 'No mapped boundary'}</p>
        <button type="button" onClick={() => features[0] && onSelectFeature(features[0])}>Select returned evidence ({features.length})</button>
      </>
    );
  }
}));

import { ResearchWorkspace } from '@/components/research/ResearchWorkspace';

const area: AreaSelection = {
  id: 'osm:relation/123',
  name: 'Pune',
  displayName: 'Pune, Maharashtra, India',
  countryCode: 'in',
  state: 'Maharashtra',
  district: 'Pune',
  source: { name: 'Nominatim', url: 'https://nominatim.openstreetmap.org/' },
  geometry: { type: 'Polygon', coordinates: [[[73.7, 18.4], [73.9, 18.4], [73.9, 18.6], [73.7, 18.4]]] },
  bbox: [73.7, 18.4, 73.9, 18.6]
};

const feature: ResearchFeature = {
  id: 'node/1',
  layerId: 'healthcare',
  title: 'Live care facility',
  geometry: { type: 'Point', coordinates: [73.85, 18.52] },
  mode: 'current',
  status: 'operational',
  impact: 'positive',
  explanation: 'A source-backed facility returned by the layer service.',
  attributes: [
    { label: 'Operator', value: 'Test operator' },
    { label: 'Opening hours', value: '24/7' },
  ],
  source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/1', sourceType: 'community', fetchedAt: '2026-07-26T12:00:00.000Z' },
  confidence: { evidence: 'medium', geography: 'exact' }
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function errorResponse(error: unknown): Response {
  return new Response(JSON.stringify({ error }), { status: 422, headers: { 'Content-Type': 'application/json' } });
}

function layerResponse(
  layerId: 'healthcare' | 'flood',
  features: readonly ResearchFeature[],
  level: 'strong' | 'unavailable',
  responseArea: AreaSelection = area
): LayerQueryResponse {
  return {
    area: responseArea,
    mode: layerId === 'flood' ? 'future' : 'current',
    layers: [{
      layerId,
      features,
      coverage: {
        layerId,
        level,
        message: level === 'unavailable' ? 'No live future source adapter is configured for this layer; no features were generated.' : 'Live OpenStreetMap query completed with one feature.',
        sourcesChecked: [],
        sourcesSucceeded: level === 'strong' ? [{ name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' }] : []
      }
    }],
    generatedAt: '2026-07-26T12:00:00.000Z'
  };
}

async function searchAndConfirm() {
  fireEvent.change(screen.getByLabelText('Search for an area'), { target: { value: 'Pune' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('Pune, Maharashtra, India');
  fireEvent.click(screen.getByRole('button', { name: /Pune, Maharashtra, India/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm area' }));
}

describe('ResearchWorkspace orchestration', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('does not request APIs before submit, requires confirmation, then queries only after a layer is toggled and exposes its source link', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        results: [area],
        source: {
          name: 'OpenStreetMap Nominatim',
          url: 'https://nominatim.openstreetmap.org/',
          attribution: 'Search data © OpenStreetMap contributors, via Nominatim'
        }
      }))
      .mockResolvedValueOnce(jsonResponse(layerResponse('healthcare', [feature], 'strong')));
    render(<ResearchWorkspace />);

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Search for an area'), { target: { value: 'Pune' } });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Pune, Maharashtra, India');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/areas/search?q=Pune');
    expect(screen.getByRole('link', { name: 'Search data © OpenStreetMap contributors, via Nominatim' }))
      .toHaveAttribute('href', 'https://nominatim.openstreetmap.org/');

    fireEvent.click(screen.getByRole('button', { name: /Pune, Maharashtra, India/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm area' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Boundary confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm area' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Healthcare/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/layers/query');
    const request = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(request).toEqual({ areaId: area.id, mode: 'current', layerIds: ['healthcare'] });
    expect(request).not.toHaveProperty('area');
    expect(request).not.toHaveProperty('geometry');

    await screen.findByRole('button', { name: 'Select returned evidence (1)' });
    fireEvent.click(screen.getByRole('button', { name: 'Select returned evidence (1)' }));
    expect(screen.getByRole('link', { name: 'Open original source' })).toHaveAttribute('href', feature.source.url);
    expect(screen.getByText('Mapped attributes')).toBeInTheDocument();
    expect(screen.getByText('Test operator')).toBeInTheDocument();
  });

  it('shows future unavailability only when the API reports it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [area] }))
      .mockResolvedValueOnce(jsonResponse(layerResponse('flood', [], 'unavailable')));
    render(<ResearchWorkspace />);

    await searchAndConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'future' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Flood risk/i }));
    await screen.findByText(/No live future source adapter is configured/i);
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });

  it('shows a layer API error returned by the server and clears it after a successful retry', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [area] }))
      .mockResolvedValueOnce(errorResponse('This layer is not available for the selected area.'))
      .mockResolvedValueOnce(jsonResponse(layerResponse('healthcare', [feature], 'strong')));
    render(<ResearchWorkspace />);

    await searchAndConfirm();
    fireEvent.click(screen.getByRole('checkbox', { name: /Healthcare/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This layer is not available for the selected area.');

    fireEvent.click(screen.getByRole('checkbox', { name: /Healthcare/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Healthcare/i }));

    await screen.findByRole('button', { name: 'Select returned evidence (1)' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears a layer error when the last selected layer is removed', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [area] }))
      .mockResolvedValueOnce(errorResponse('This layer is not available for the selected area.'));
    render(<ResearchWorkspace />);

    await searchAndConfirm();
    const healthcare = screen.getByRole('checkbox', { name: /Healthcare/i });
    fireEvent.click(healthcare);
    expect(await screen.findByRole('alert')).toHaveTextContent('This layer is not available for the selected area.');

    fireEvent.click(healthcare);

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('adopts an authoritative boundary change without repeatedly re-querying it', async () => {
    const authoritativeArea: AreaSelection = {
      ...area,
      geometry: { type: 'Polygon', coordinates: [[[73.6, 18.3], [74, 18.3], [74, 18.7], [73.6, 18.3]]] },
      bbox: [73.6, 18.3, 74, 18.7]
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [area] }))
      .mockResolvedValueOnce(jsonResponse(layerResponse('healthcare', [feature], 'strong', authoritativeArea)));
    render(<ResearchWorkspace />);

    await searchAndConfirm();
    expect(screen.getByLabelText('Mapped boundary')).toHaveTextContent(`${area.id}: ${area.bbox.join(',')}`);
    fireEvent.click(screen.getByRole('checkbox', { name: /Healthcare/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Mapped boundary')).toHaveTextContent(`${authoritativeArea.id}: ${authoritativeArea.bbox.join(',')}`);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ areaId: area.id, mode: 'current', layerIds: ['healthcare'] });
  });
});
