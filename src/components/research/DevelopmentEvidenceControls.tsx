import Link from 'next/link';
import { developmentStages, type DevelopmentStage } from '@/domain/neighborhoodEvidence';
import type { ResearchFeature } from '@/types/research';

interface Props {
  stage: DevelopmentStage | null;
  onStage: (stage: DevelopmentStage) => void;
  onMap: readonly ResearchFeature[];
  offMap: readonly ResearchFeature[];
  onSelect: (feature: ResearchFeature) => void;
  confirmed: boolean;
}

export function DevelopmentEvidenceControls({ stage, onStage, onMap, offMap, onSelect, confirmed }: Props) {
  const active = developmentStages.find(({ key }) => stage === key);
  return <section aria-labelledby="development-evidence-title" className="border-b border-white/10 px-5 py-5">
    <h2 id="development-evidence-title" className="text-sm font-semibold text-slate-100">Development near this area</h2>
    <p className="mt-2 text-xs leading-relaxed text-slate-400">Check nearby changes before relying on views, light or access. Area research is not a parcel survey or a prediction.</p>
    <div aria-label="Development evidence stages" className="mt-3 flex flex-wrap gap-2" role="group">
      {developmentStages.map(({ key, label }) => (
        <button type="button" key={key} aria-pressed={stage === key} onClick={() => onStage(key)}
          className={`rounded border px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-cyan-300 ${stage === key ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-slate-600 text-slate-200'}`}>
          {label}
        </button>
      ))}
    </div>
    {active && <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300">
      <p role="status">{!confirmed ? 'Confirm an area to see what the map can show.' : onMap.length ? `${onMap.length} mapped result(s) for this stage.` : active.empty}</p>
      {onMap.length > 0 && <details>
        <summary className="cursor-pointer text-cyan-200">Inspect mapped records</summary>
        <ul className="mt-1 space-y-1">
          {onMap.slice(0, 12).map((feature) => <li key={feature.id}><button type="button" onClick={() => onSelect(feature)} className="text-left text-cyan-200 underline">{feature.title}</button></li>)}
        </ul>
        {onMap.length > 12 && <p>First 12 listed; use the map for other records.</p>}
      </details>}
      {offMap.length > 0 && <div>
        <p>Records not placed on the map: geometry or exact parcel match is unverified.</p>
        <ul className="mt-1 space-y-1">
          {offMap.map((feature) => <li key={feature.id}><button type="button" onClick={() => onSelect(feature)} className="text-left text-cyan-200 underline">{feature.title}</button></li>)}
        </ul>
      </div>}
      {active.mode === 'future' && <p>
        Confirm parcel ID, issuing authority, date and document page yourself. Get an independent local site check.
        {' '}<Link href="/city-plans" className="text-cyan-200 underline">Find official starting points</Link>.
      </p>}
    </div>}
  </section>;
}
