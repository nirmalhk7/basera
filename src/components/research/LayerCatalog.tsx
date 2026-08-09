'use client';

import { RESEARCH_LAYERS } from '@/config/researchLayers';
import type { AreaCatalogEntry, LayerDefinition, LayerId, ResearchMode } from '@/types/research';

export interface LayerCoverageView {
  level: string;
  message?: string;
}

interface LayerCatalogProps {
  mode: ResearchMode;
  disabled: boolean;
  selectedLayerIds: readonly LayerId[];
  loadingLayerIds: readonly LayerId[];
  coverageByLayer: Record<string, LayerCoverageView>;
  catalogByLayer: Record<string, AreaCatalogEntry>;
  onToggle: (layerId: LayerId) => void;
}

function coverageTone(level?: string): string {
  if (level === 'available') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200';
  if (level === 'unavailable') return 'border-amber-300/30 bg-amber-300/10 text-amber-200';
  if (level === 'partial') return 'border-orange-300/30 bg-orange-300/10 text-orange-200';
  if (level === 'failed') return 'border-rose-300/30 bg-rose-300/10 text-rose-200';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

export function LayerCatalog({
  mode,
  disabled,
  selectedLayerIds,
  loadingLayerIds,
  coverageByLayer,
  catalogByLayer,
  onToggle
}: LayerCatalogProps) {
  const layers: readonly LayerDefinition[] = RESEARCH_LAYERS;
  const heading = mode === 'future' ? 'Future scenarios' : 'Current conditions';

  return (
    <section aria-labelledby="layer-catalog-title" className="border-b border-white/10 px-5 py-5">
      <div className="mb-3">
        <p className="text-[10px] font-bold tracking-[0.22em] text-cyan-300/80 uppercase">Layer catalog</p>
        <h2 id="layer-catalog-title" className="mt-1 text-sm font-semibold text-white">{heading}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">Select only the data layers you want to request.</p>
      </div>

      {layers.length ? (
        <ul className="space-y-2">
          {layers.map((layer) => {
            const selected = selectedLayerIds.includes(layer.id);
            const loading = loadingLayerIds.includes(layer.id);
            const coverage = coverageByLayer[layer.id];
            const catalog = catalogByLayer[layer.id];
            const availability = coverage?.level ?? catalog?.availability;
            const liveCapable = catalog ? catalog.availability !== 'unavailable' : layer.supportedModes.includes(mode);
            return (
              <li key={layer.id} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                <label className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onToggle(layer.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400 disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-100">{layer.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{layer.description}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-semibold tracking-wide uppercase ${liveCapable ? 'text-emerald-300/80' : 'text-slate-500'}`}>
                        {availability ?? (liveCapable ? 'partial' : 'unavailable')}
                      </span>
                      {loading ? <span className="rounded border border-cyan-300/30 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-100 uppercase">Loading</span> : null}
                      {availability ? <span title={coverage?.message ?? catalog?.limitation} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${coverageTone(availability)}`}>{availability}</span> : null}
                    </span>
                    {coverage?.message || catalog?.limitation ? <span className="mt-1 block text-xs text-slate-400">{coverage?.message ?? catalog?.limitation}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3 text-sm text-slate-400">No {mode} layers are configured.</p>
      )}
      {disabled ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Confirm an area before requesting live source layers.</p>
      ) : null}
    </section>
  );
}
