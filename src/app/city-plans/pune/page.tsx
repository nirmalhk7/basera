import type { Metadata } from 'next';
import Link from 'next/link';
import { puneSources, sourceReviewDate } from '@/domain/puneBuyerPilot';

export const metadata: Metadata = { title: 'Pune metropolitan planning guide | Basera' };

export default function CityPlansPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/" className="text-sm text-cyan-300 underline underline-offset-4">Back to the area research map</Link>
        <Link href="/city-plans" className="ml-4 text-sm text-cyan-300 underline underline-offset-4">All India coverage</Link>
        <header>
          <p className="text-sm font-medium text-cyan-300">Planning source pilot · Maharashtra</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Pune metropolitan planning guide</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">Understand what the plan says about an area, then verify the exact property separately. Basera’s first source guide covers PMRDA-planned areas only, not every address marketed as Pune or everywhere in India.</p>
        </header>
        <section aria-labelledby="planning-sources" className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5">
          <h2 id="planning-sources" className="text-lg font-semibold">Start with the planning authority</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Confirm the authority for the exact parcel before using these sources. An area selection on the map does not establish jurisdiction. If you cannot confirm PMRDA applies, ask the municipality or local planning office; coverage from this guide is unverified for that parcel.</p>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-semibold">1997 Pune District Regional Plan · Approved, as described by PMRDA</dt>
              <dd className="mt-1 text-slate-300">Issuer shown on this source: {puneSources.planningStatus.issuer} (guidance page). Confirm later amendments and parcel coverage with the authority.</dd>
            </div>
            <div>
              <dt className="font-semibold">2021 PMRDA Development Plan · Draft, as described by PMRDA</dt>
              <dd className="mt-1 text-slate-300">Issuer: {puneSources.planning.issuer}. Do not assume a draft is sanctioned or that a proposed road, amenity, or use will be approved or built.</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-cyan-300 underline underline-offset-4">
            {[puneSources.planning, puneSources.planningStatus].map((source) => <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">{source.name} (new tab)</a>)}
          </div>
          <p className="mt-3 text-sm text-slate-400">Source links reviewed <time dateTime={sourceReviewDate}>{sourceReviewDate}</time>. No live portal lookup, parcel overlay, exact effective version, or property-status verification is provided by Basera.</p>
        </section>
        <section aria-labelledby="buyer-path" className="rounded-2xl border border-slate-700 bg-slate-900/75 p-5">
          <h2 id="buyer-path" className="text-lg font-semibold">Choose a property check</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">A plan or neighborhood layer is not a parcel record, title decision, approval, or payment clearance.</p>
          <nav aria-label="Property type" className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/buyer-check?jurisdiction=maharashtra" className="rounded-xl border border-slate-600 p-4 hover:border-emerald-300"><span className="block font-semibold text-emerald-300">New-build flat</span><span className="mt-1 block text-sm text-slate-300">Compare the listing with the exact project phase on MahaRERA.</span></Link>
            <Link href="/buyer-check/plot?jurisdiction=maharashtra" className="rounded-xl border border-slate-600 p-4 hover:border-emerald-300"><span className="block font-semibold text-emerald-300">Plot or land</span><span className="mt-1 block text-sm text-slate-300">Identify land records and prepare a lawyer and surveyor handoff.</span></Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
