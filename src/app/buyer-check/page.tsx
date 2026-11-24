import type { Metadata } from 'next';
import Link from 'next/link';
import { BuyerEvidenceCheck } from '@/components/buyer/BuyerEvidenceCheck';
import { buyerPath, nationalRera, resolveJurisdiction } from '@/domain/indiaCoverage';
import { sourceReviewDate } from '@/domain/puneBuyerPilot';

export const metadata: Metadata = {
  title: 'Remote buyer evidence check | Basera',
  description: 'Compare a new-build listing with details you independently find in the relevant official project registry.',
};

export default async function BuyerCheckPage({ searchParams }: { searchParams: Promise<{ jurisdiction?: string | string[] }> }) {
  const location = resolveJurisdiction((await searchParams).jurisdiction);
  return (
    <main className="h-dvh overflow-y-auto bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <nav aria-label="Buyer navigation" className="flex flex-wrap gap-4 text-sm font-medium text-emerald-300 underline underline-offset-4">
          <Link href="/">Area research</Link>
          <Link href="/city-plans">City plans and state selection</Link>
          <Link href={buyerPath('plot', location?.key)}>Plot or land checklist</Link>
        </nav>
        <header className="mb-7 mt-6">
          <p className="text-sm font-medium text-emerald-300">{location?.name ?? 'India · Location unconfirmed'} · New-build apartments</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Remote buyer evidence check</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
            Compare a developer’s listing with details you find independently. Use only public project details;
            don’t enter identity documents, contact details, or payment information. Your entries stay on this page and aren’t sent or saved.
          </p>
          <p className="mt-2 text-sm text-slate-400">Source starting point: {location?.rera?.issuer ?? nationalRera.issuer}. Portal reference reviewed <time dateTime={sourceReviewDate}>{sourceReviewDate}</time>; Basera does not check the record or its date.</p>
        </header>
        <BuyerEvidenceCheck key={location?.key ?? 'unknown'} source={location?.rera ?? null} />
        <section aria-labelledby="next-heading" className="mt-8 border-t border-slate-700 pb-4 pt-6">
          <h2 id="next-heading" className="text-lg font-semibold">Before you pay or sign</h2>
          <ul className="mt-4 grid list-disc gap-3 pl-5 text-sm leading-relaxed text-slate-300">
            <li>Ask an independent local property lawyer to review title, encumbrances, applicable approvals, the agreement and the seller’s authority.</li>
            <li>Have a trusted local person independently confirm the site, phase, and unit being offered.</li>
            <li>Verify the payee and payment instructions through independently obtained contact details. Pause if someone pressures you to pay or asks you to use a personal account.</li>
          </ul>
          <p className="mt-4 text-sm text-slate-400">This is a research aid, not legal advice or a fraud, title, or payment clearance.</p>
        </section>
      </div>
    </main>
  );
}
