'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AreaSearchResult,
  AreaSelection,
  LayerCoverage,
  LayerId,
  LayerQueryRequest,
  LayerQueryResponse,
  ResearchFeature,
  ResearchMode
} from '@/types/research';
import { AreaSearch, type AreaSearchSource } from './AreaSearch';
import { EvidencePanel } from './EvidencePanel';
import { LayerCatalog, type LayerCoverageView } from './LayerCatalog';

const ResearchMap = dynamic(() => import('./ResearchMap').then((module) => module.ResearchMap), {
  ssr: false,
  loading: () => <div className="min-h-[480px] bg-slate-950" aria-label="Loading research map" />
});

type ModeData<T> = Record<ResearchMode, T>;

const initialFeatures: ModeData<readonly ResearchFeature[]> = { current: [], future: [] };
const initialCoverage: ModeData<Record<string, LayerCoverageView>> = { current: {}, future: {} };

interface AreaSearchResponse {
  readonly results: AreaSearchResult[];
  readonly source: AreaSearchSource | null;
}

function safeSearchSource(value: unknown): AreaSearchSource | null {
  if (!value || typeof value !== 'object') return null;
  const { name, url, attribution } = value as Record<string, unknown>;
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof url !== 'string' || !url.trim() ||
    typeof attribution !== 'string' || !attribution.trim()
  ) return null;

  try {
    const parsedUrl = new URL(url);
    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      parsedUrl.username || parsedUrl.password
    ) return null;
  } catch {
    return null;
  }

  return { name: name.trim(), url: url.trim(), attribution: attribution.trim() };
}

function searchResponseFrom(payload: unknown): AreaSearchResponse {
  if (Array.isArray(payload)) return { results: payload as AreaSearchResult[], source: null };
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)) {
    return {
      results: (payload as { results: AreaSearchResult[] }).results,
      source: safeSearchSource((payload as { source?: unknown }).source)
    };
  }
  return { results: [], source: null };
}

function coverageViews(layers: readonly { coverage: LayerCoverage }[]): Record<string, LayerCoverageView> {
  return Object.fromEntries(layers.map((layer) => [layer.coverage.layerId, {
    level: layer.coverage.level,
    message: layer.coverage.message
  }]));
}

async function layerRequestError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error;
  }
  return 'Layer research request failed.';
}

function hasSameBoundary(left: AreaSelection, right: AreaSelection): boolean {
  return left.id === right.id &&
    left.bbox.every((coordinate, index) => coordinate === right.bbox[index]) &&
    left.geometry.type === right.geometry.type &&
    JSON.stringify(left.geometry.coordinates) === JSON.stringify(right.geometry.coordinates);
}

export function ResearchWorkspace() {
  const [searchResults, setSearchResults] = useState<AreaSearchResult[]>([]);
  const [searchSource, setSearchSource] = useState<AreaSearchSource | null>(null);
  const [pendingArea, setPendingArea] = useState<AreaSearchResult | null>(null);
  const [confirmedArea, setConfirmedArea] = useState<AreaSelection | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mode, setMode] = useState<ResearchMode>('current');
  const [selectedLayerIds, setSelectedLayerIds] = useState<ModeData<readonly LayerId[]>>({ current: [], future: [] });
  const [loadingLayerIds, setLoadingLayerIds] = useState<readonly LayerId[]>([]);
  const [featuresByMode, setFeaturesByMode] = useState<ModeData<readonly ResearchFeature[]>>(initialFeatures);
  const [coverageByMode, setCoverageByMode] = useState<ModeData<Record<string, LayerCoverageView>>>(initialCoverage);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<ResearchFeature | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const layerAbortRef = useRef<AbortController | null>(null);
  const confirmedAreaId = confirmedArea?.id ?? null;

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    layerAbortRef.current?.abort();
  }, []);

  const searchAreas = useCallback(async (query: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setPendingArea(null);
    setSearchResults([]);
    setSearchSource(null);

    try {
      const response = await fetch(`/api/areas/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Area search was unavailable.');
      const payload: unknown = await response.json();
      if (!controller.signal.aborted) {
        const searchResponse = searchResponseFrom(payload);
        setSearchResults(searchResponse.results);
        setSearchSource(searchResponse.source);
      }
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : 'Area search failed.');
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  }, []);

  const confirmArea = useCallback(() => {
    if (!pendingArea) return;
    layerAbortRef.current?.abort();
    setConfirmedArea(pendingArea);
    setPendingArea(null);
    setSelectedFeature(null);
    setFeaturesByMode(initialFeatures);
    setCoverageByMode(initialCoverage);
    setLayerError(null);
    setLoadingLayerIds([]);
  }, [pendingArea]);

  const toggleLayer = useCallback((layerId: LayerId) => {
    if (!confirmedArea) return;
    const active = selectedLayerIds[mode];
    const next = active.includes(layerId) ? active.filter((id) => id !== layerId) : [...active, layerId];
    setSelectedFeature(null);
    setLoadingLayerIds(next);
    if (next.length === 0) {
      setFeaturesByMode((existing) => ({ ...existing, [mode]: [] }));
      setLayerError(null);
    }
    setSelectedLayerIds((previous) => ({ ...previous, [mode]: next }));
  }, [confirmedArea, mode, selectedLayerIds]);

  useEffect(() => {
    const layerIds = selectedLayerIds[mode];
    if (!confirmedAreaId || layerIds.length === 0) {
      layerAbortRef.current?.abort();
      return;
    }

    layerAbortRef.current?.abort();
    const controller = new AbortController();
    layerAbortRef.current = controller;
    const request: LayerQueryRequest = { areaId: confirmedAreaId, mode, layerIds };

    void (async () => {
      setLayerError(null);
      try {
        const response = await fetch('/api/layers/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(await layerRequestError(response));
        const payload = await response.json() as LayerQueryResponse;
        if (controller.signal.aborted) return;
        setLayerError(null);
        setConfirmedArea((previous) => previous && hasSameBoundary(previous, payload.area) ? previous : payload.area);
        setFeaturesByMode((previous) => ({ ...previous, [mode]: payload.layers.flatMap((layer) => layer.features) }));
        setCoverageByMode((previous) => ({ ...previous, [mode]: coverageViews(payload.layers) }));
      } catch (error) {
        if (!controller.signal.aborted) setLayerError(error instanceof Error ? error.message : 'Layer research request failed.');
      } finally {
        if (!controller.signal.aborted) setLoadingLayerIds([]);
      }
    })();

    return () => controller.abort();
  }, [confirmedAreaId, mode, selectedLayerIds]);

  const activeLayers = selectedLayerIds[mode];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur xl:px-7">
        <p className="text-[10px] font-bold tracking-[0.26em] text-cyan-300/80 uppercase">Basera · Phase 1</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-xl font-semibold tracking-tight text-white">Geospatial research workspace</h1><p className="mt-1 text-sm text-slate-400">Area-bound evidence, returned only by connected sources.</p></div>
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1" aria-label="Research time mode">
            {(['current', 'future'] as const).map((candidate) => <button key={candidate} type="button" onClick={() => { setMode(candidate); setSelectedFeature(null); setLayerError(null); setLoadingLayerIds(confirmedArea ? selectedLayerIds[candidate] : []); }} aria-pressed={mode === candidate} className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition ${mode === candidate ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{candidate}</button>)}
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-105px)] grid-cols-1 lg:h-[calc(100vh-105px)] lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_280px] xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <aside className="order-2 border-r border-white/10 bg-slate-900/35 lg:order-1 lg:max-h-[calc(100vh-105px)] lg:overflow-y-auto">
          <AreaSearch results={searchResults} source={searchSource} isSearching={isSearching} error={searchError} selectedArea={pendingArea} confirmedArea={confirmedArea} hasSearched={hasSearched} onSearch={searchAreas} onSelect={setPendingArea} onConfirm={confirmArea} onCancel={() => setPendingArea(null)} />
          <LayerCatalog
            mode={mode}
            disabled={!confirmedArea}
            selectedLayerIds={activeLayers}
            loadingLayerIds={loadingLayerIds}
            coverageByLayer={coverageByMode[mode]}
            onToggle={toggleLayer}
          />
          {layerError ? <p role="alert" className="px-5 pb-5 text-sm text-rose-300">{layerError}</p> : null}
        </aside>
        <div className="order-1 lg:order-2"><ResearchMap area={confirmedArea} features={featuresByMode[mode]} selectedFeatureId={selectedFeature?.id ?? null} onSelectFeature={setSelectedFeature} /></div>
        <div className="order-3"><EvidencePanel feature={selectedFeature} /></div>
      </div>
    </main>
  );
}
