'use client';

import { useState } from 'react';
import {
  evidenceStatuses, plotChecks, plotVerificationProgress,
  type EvidenceStatus, type PlotEvidence,
} from '@/domain/puneBuyerPilot';
import { nationalLand, type OfficialSource } from '@/domain/indiaCoverage';

const statusLabels: Record<EvidenceStatus, string> = {
  unverified: 'Unverified or unavailable',
  'reported-reviewed': 'I obtained and reviewed evidence',
  discrepancy: 'Discrepancy or concern',
  'not-applicable': 'Possibly not applicable; confirm with an expert',
};

const progressLabels = {
  'resolve-discrepancy': 'Pause payment. Resolve the discrepancy with an independent professional.',
  'continue-verification': 'Continue verification only. Do not pay on the strength of this checklist.',
  'recheck-before-payment': 'You marked the evidence reviewed. This is not payment clearance. Confirm current documents and the payee with your independent advisers before acting.',
};

export function PlotEvidenceCheck({ land, cadastral }: { land?: OfficialSource; cadastral?: OfficialSource }) {
  const references = { land: land ?? nationalLand, cadastral };
  const [evidence, setEvidence] = useState<PlotEvidence>({});
  return (
    <div className="space-y-4">
      {plotChecks.map(({ id, label, detail, source }) => {
       const reference = source && source !== 'planning' ? references[source] : null;
       return (
        <section key={id} aria-labelledby={`plot-${id}-label`} className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5">
          <h2 className="font-semibold" id={`plot-${id}-label`}>{label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{detail}</p>
          {reference && <div className="mt-2 text-sm text-slate-400">
            <a className="text-emerald-300 underline underline-offset-4" href={reference.href} target="_blank" rel="noopener noreferrer">{reference.name} (new tab)</a>
            <span className="block">{reference.issuer} · Official source; no parcel lookup performed</span>
          </div>}
          <select aria-labelledby={`plot-${id}-label`} className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 sm:w-auto"
            value={evidence[id] ?? 'unverified'}
            onChange={(event) => {
              const status = evidenceStatuses.find((item) => item === event.target.value);
              if (status) setEvidence((previous) => ({ ...previous, [id]: status }));
            }}>
            {evidenceStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </section>
      ); })}
      <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-100" role="status">
        {progressLabels[plotVerificationProgress(evidence)]}
      </div>
      <button type="button" onClick={() => setEvidence({})} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Clear plot check</button>
    </div>
  );
}
