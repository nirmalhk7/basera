'use client';

import { useState } from 'react';
import {
  blankProject, compareBuyerEvidence, fields,
  type LookupStatus, type ProjectDetails,
} from '@/domain/buyerEvidence';
import { nationalRera, type OfficialSource } from '@/domain/indiaCoverage';
import { MAHARERA_PORTAL } from '@/domain/buyerEvidence';

const lookupStatuses = [
  { key: 'not-checked', label: 'I haven’t checked the portal yet' },
  { key: 'record-found', label: 'I opened a record on the official portal' },
  { key: 'not-found', label: 'I couldn’t find a matching record' },
  { key: 'portal-unavailable', label: 'I couldn’t access the portal' },
] as const satisfies ReadonlyArray<{ key: LookupStatus; label: string }>;

const outcomes = {
  discrepancy: 'Pause: the entered details differ',
  unverified: 'Not enough evidence to compare',
  'entered-fields-match': 'Entered details match. Keep checking.',
};

const explanations = {
  discrepancy: 'Ask for the record for the exact project phase and an explanation of each difference before relying on the listing or paying.',
  'entered-fields-match': 'This is a text comparison of what you entered, not independent verification. A matching record does not establish title, seller authority, payment instructions, or that it is safe to buy.',
};

const unverifiedByLookup = {
  'not-checked': 'Open the official portal yourself and compare the exact project phase, not a screenshot or link sent by the seller.',
  'record-found': 'Copy the missing details from the exact record, or leave them blank if the portal doesn’t show them.',
  'not-found': 'Recheck the registration number and phase. An unsuccessful search is not proof that a project is unregistered.',
  'portal-unavailable': 'Try the official portal again later or ask an independent local professional to help. An unavailable portal proves nothing about registration.',
};

const fieldStatus = {
  match: 'Entered text matches',
  mismatch: 'Different text',
  unverified: 'Not compared',
};

function DetailsFields({ heading, details, onChange }: {
  heading: string;
  details: ProjectDetails;
  onChange: (details: ProjectDetails) => void;
}) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900/75 px-5 pb-5">
      <legend className="px-2 text-sm font-semibold text-slate-100">{heading}</legend>
      <div className="mt-3 grid gap-4">
        {fields.map(({ key, label }) => (
          <label key={key} className="grid gap-1.5 text-sm text-slate-200">
            {label}
            <input
              className="min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-50 outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-300"
              autoComplete="off"
              maxLength={180}
              value={details[key]}
              onChange={(event) => onChange({ ...details, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const defaultSource = { name: 'Official MahaRERA portal', issuer: 'Maharashtra Real Estate Regulatory Authority', href: MAHARERA_PORTAL };

export function BuyerEvidenceCheck({ source = defaultSource }: { source?: OfficialSource | null }) {
  const reference = source ?? nationalRera;
  const [claim, setClaim] = useState(blankProject);
  const [record, setRecord] = useState(blankProject);
  const [lookup, setLookup] = useState<LookupStatus>('not-checked');
  const { outcome, comparison } = compareBuyerEvidence(claim, record, lookup);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <DetailsFields heading="1. What the listing says" details={claim} onChange={setClaim} />
        <section aria-labelledby="lookup-heading" className="grid content-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/75 p-5">
          <h2 id="lookup-heading" className="text-sm font-semibold">2. Look up the project yourself</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            {source ? 'Open the official project search and use the registration number from the listing. Open the record and check the exact phase; a similar project name is not enough.' : 'Choose the correct regulator from the national directory after confirming the state or union territory. The directory is not a project lookup. Only enter details from the exact record you found independently.'}
          </p>
          <a href={reference.href} target="_blank" rel="noopener noreferrer" className="w-fit text-sm font-medium text-emerald-300 underline underline-offset-4">
            Open {reference.name} (new tab)
          </a>
          <label className="mt-2 grid gap-1.5 text-sm text-slate-200">
            What happened in your lookup?
            <select
              value={lookup}
              className="min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-50 outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-300"
              onChange={(event) => {
                const next = lookupStatuses.find(({ key }) => key === event.target.value)?.key;
                if (!next) return;
                setLookup(next);
                if (next !== 'record-found') setRecord(blankProject);
              }}
            >
              {lookupStatuses.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </section>
      </div>
      {lookup === 'record-found' && (
        <DetailsFields heading="3. Copy only these details from the record" details={record} onChange={setRecord} />
      )}
      <section aria-labelledby="comparison-heading" className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5">
        <h2 id="comparison-heading" className="text-lg font-semibold">Evidence comparison</h2>
        <div role="status" className="mt-3">
          <p className={outcome === 'discrepancy' ? 'font-semibold text-amber-200' : 'font-semibold text-slate-100'}>{outcomes[outcome]}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{outcome === 'unverified' ? unverifiedByLookup[lookup] : explanations[outcome]}</p>
        </div>
        <dl className="mt-4 divide-y divide-slate-700">
          {comparison.map(({ key, label, status }) => (
            <div key={key} className="grid gap-1 py-2 text-sm sm:grid-cols-2">
              <dt className="font-medium text-slate-200">{label}</dt>
              <dd className={status === 'mismatch' ? 'text-amber-200' : 'text-slate-300'}>{fieldStatus[status]}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-300"
          onClick={() => { setClaim(blankProject); setRecord(blankProject); setLookup('not-checked'); }}
        >
          Clear this check
        </button>
      </section>
    </div>
  );
}
