'use client';

import type { ResearchFeature } from '@/types/research';

interface EvidencePanelProps {
  feature: ResearchFeature | null;
}

export function EvidencePanel({ feature }: EvidencePanelProps) {
  if (!feature) {
    return (
      <aside aria-labelledby="evidence-title" className="border-l border-white/10 bg-slate-950/80 p-5 lg:overflow-y-auto">
        <p className="text-[10px] font-bold tracking-[0.22em] text-cyan-300/80 uppercase">Evidence</p>
        <h2 id="evidence-title" className="mt-1 text-sm font-semibold text-white">No evidence selected</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">Choose a returned map feature to inspect its source-backed details. Nothing is shown before a source responds.</p>
      </aside>
    );
  }

  return (
    <aside aria-labelledby="evidence-title" className="border-l border-white/10 bg-slate-950/80 p-5 lg:overflow-y-auto">
      <p className="text-[10px] font-bold tracking-[0.22em] text-cyan-300/80 uppercase">Evidence</p>
      <h2 id="evidence-title" className="mt-1 text-base font-semibold text-white">{feature.title}</h2>
      <p className="mt-1 text-xs font-medium text-cyan-200">{feature.layerId} · {feature.status}</p>
      {feature.containment === 'intersects' ? (
        <p className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-100">
          Boundary relation: intersects. The source geometry crosses the selected area; it is not wholly inside.
        </p>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-slate-300">{feature.explanation}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-white/10 bg-white/[0.025] p-2"><dt className="text-slate-500">Impact</dt><dd className="mt-1 font-medium text-slate-200 capitalize">{feature.impact}</dd></div>
        <div className="rounded border border-white/10 bg-white/[0.025] p-2"><dt className="text-slate-500">Confidence</dt><dd className="mt-1 font-medium text-slate-200 capitalize">{feature.confidence.evidence} evidence</dd></div>
        <div className="rounded border border-white/10 bg-white/[0.025] p-2"><dt className="text-slate-500">Geography</dt><dd className="mt-1 font-medium text-slate-200 capitalize">{feature.confidence.geography}</dd></div>
        <div className="rounded border border-white/10 bg-white/[0.025] p-2"><dt className="text-slate-500">Record state</dt><dd className="mt-1 font-medium text-slate-200 capitalize">{feature.status}</dd></div>
      </dl>
      {feature.attributes?.length ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">Mapped attributes</p>
          <dl className="mt-2 space-y-2 text-xs">
            {feature.attributes.map((attribute) => (
              <div key={`${attribute.label}:${attribute.value}`} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
                <dt className="text-slate-500">{attribute.label}</dt>
                <dd className="break-words text-slate-300">{attribute.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">Source</p>
        <p className="mt-1 text-sm text-slate-200">{feature.source.name} <span className="text-slate-500">· {feature.source.sourceType}</span></p>
        <p className="mt-1 text-xs text-slate-500">Fetched {new Date(feature.source.fetchedAt).toLocaleString()}</p>
        <a href={feature.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/10">
            Open original source
        </a>
      </div>
    </aside>
  );
}
