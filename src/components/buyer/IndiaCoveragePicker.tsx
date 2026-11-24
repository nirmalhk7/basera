'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buyerPath, nationalLand, nationalRera, resolveJurisdiction, statesAndTerritories, type OfficialSource } from '@/domain/indiaCoverage';

const panel = 'rounded-2xl border border-slate-700 bg-slate-900/75 p-5';

function Source({ source }: { source: OfficialSource }) {
  return <p className="text-sm text-slate-300">
    <a href={source.href} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-4">{source.name} (new tab)</a>
    <span className="block">Publisher: {source.issuer}</span>
  </p>;
}

export function IndiaCoveragePicker() {
  const [value, setValue] = useState('');
  const [area, setArea] = useState<'not-confirmed' | 'matches' | 'other'>('not-confirmed');
  const jurisdiction = resolveJurisdiction(value);
  const planning = jurisdiction?.planning;
  const citySource = area === 'matches' && planning ? planning : null;

  return <div className="grid gap-5">
    <section className={panel} aria-labelledby="jurisdiction-title">
      <h2 id="jurisdiction-title" className="font-semibold">1. Choose the property’s state or union territory</h2>
      <p className="mt-2 text-sm text-slate-300">Use the exact location in the property records, not a nearby city mentioned in a listing. For example, a property marketed as Delhi NCR may be in Delhi, Haryana, or Uttar Pradesh. If the state is uncertain, use the manual path and confirm it first.</p>
      <div className="mt-4 grid max-w-md gap-2 text-sm font-medium">
        <label htmlFor="buyer-jurisdiction">State or union territory</label>
        <select id="buyer-jurisdiction" value={value} onChange={(event) => { setValue(event.target.value); setArea('not-confirmed'); }} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2">
          <option value="">Unknown / not confirmed</option>
          {statesAndTerritories.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </div>
      {planning && <div className="mt-4 grid max-w-md gap-2 text-sm font-medium">
        <label htmlFor="buyer-planning-area">Is the property in this area?</label>
        <select id="buyer-planning-area" value={area} onChange={(event) => {
          const next = event.target.value;
          if (next === 'not-confirmed' || next === 'matches' || next === 'other') setArea(next);
        }} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2">
          <option value="not-confirmed">City or planning area not confirmed</option>
          <option value="matches">{planning.city}</option>
          <option value="other">Another city or planning area</option>
        </select>
      </div>}
    </section>
    <section className={panel} aria-labelledby="planning-sources-title">
      <h2 id="planning-sources-title" className="font-semibold">2. Find the plan for that area</h2>
      <div className="mt-3 grid gap-2" aria-live="polite">
        {citySource ? <>
          <p className="text-sm text-slate-300">{citySource.coverage === 'plan-source' ? 'Official city planning source available.' : 'Official authority directory available; city plan not independently checked.'} Parcel coverage and effective plan are unverified.</p>
          <Source source={citySource} />
          {jurisdiction?.key === 'maharashtra' && <Link href="/city-plans/pune" className="text-sm text-cyan-300 underline">Read the Pune metropolitan guide</Link>}
        </> : <p className="text-sm text-amber-200">No city planning source selected. Ask the local planning or municipal office to identify the issuing authority, effective plan, amendments and applicable map sheet. Do not infer a property’s permitted use from the Basera map.</p>}
      </div>
    </section>
    <section className={panel} aria-labelledby="buyer-type-title">
      <h2 id="buyer-type-title" className="font-semibold">3. Choose a buyer workflow</h2>
      <p className="mt-2 text-sm text-slate-300">Plan coverage, project registration, parcel records, and title are separate checks. Check the publication date and issuer of each record with an independent local professional.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-2 rounded-xl border border-slate-600 p-4">
          <Link href={buyerPath('flat', jurisdiction?.key)} className="font-semibold text-emerald-300 underline">New-build flat check</Link>
          <p className="text-sm text-slate-300">{jurisdiction?.rera ? 'State project registry starting point available.' : 'State project registry not independently checked here. Start with the national directory.'}</p>
          <Source source={jurisdiction?.rera ?? nationalRera} />
        </div>
        <div className="grid content-start gap-2 rounded-xl border border-slate-600 p-4">
          <Link href={buyerPath('plot', jurisdiction?.key)} className="font-semibold text-emerald-300 underline">Plot or land checklist</Link>
          <p className="text-sm text-slate-300">{jurisdiction?.land ? 'State land-record starting point available.' : 'Local land record source not independently checked here. Start with the national programme and a local professional.'}</p>
          <Source source={jurisdiction?.land ?? nationalLand} />
        </div>
      </div>
    </section>
  </div>;
}
