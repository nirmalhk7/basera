import type { Metadata } from 'next';
import Link from 'next/link';
import { PlotEvidenceCheck } from '@/components/buyer/PlotEvidenceCheck';
import { buyerPath, resolveJurisdiction } from '@/domain/indiaCoverage';
import { sourceReviewDate } from '@/domain/puneBuyerPilot';

export const metadata: Metadata = { title: 'Remote plot buyer checklist | Basera' };

export default async function PlotBuyerCheckPage({ searchParams }: { searchParams: Promise<{ jurisdiction?: string | string[] }> }) {
  const location = resolveJurisdiction((await searchParams).jurisdiction);
  return (
    <main className="h-dvh overflow-y-auto bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
        <nav aria-label="Buyer navigation" className="flex flex-wrap gap-4 text-sm text-emerald-300 underline underline-offset-4">
          <Link href="/city-plans">City plans and state selection</Link>
          <Link href={buyerPath('flat', location?.key)}>New-build flat check</Link>
        </nav>
        <header>
          <p className="text-sm font-medium text-emerald-300">{location?.name ?? 'India · Location unconfirmed'} · Plot or land</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Remote plot buyer checklist</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            Use this to organize an independent local lawyer and surveyor handoff. Do not enter parcel identifiers, documents or payment information here. Checkmarks are your notes for this visit, not verification by Basera.
          </p>
          <p className="mt-2 text-sm text-slate-400">Source links reviewed <time dateTime={sourceReviewDate}>{sourceReviewDate}</time>. Parcel status and record dates must be checked with the issuing authority.</p>
        </header>
        <PlotEvidenceCheck key={location?.key ?? 'unknown'} land={location?.land} cadastral={location?.cadastral} />
      </div>
    </main>
  );
}
