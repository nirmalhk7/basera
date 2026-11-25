import type { Metadata } from 'next';
import Link from 'next/link';
import { IndiaCoveragePicker } from '@/components/buyer/IndiaCoveragePicker';
import { sourceReviewDate } from '@/domain/puneBuyerPilot';

export const metadata: Metadata = { title: 'City plans and property checks across India | Basera' };

export default function CityPlansPage() {
  return <main className="h-dvh overflow-y-auto bg-slate-950 text-slate-50">
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/" className="text-sm text-cyan-300 underline underline-offset-4">Back to the area research map</Link>
      <header>
        <p className="text-sm font-medium text-cyan-300">India · All states and union territories</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">City plans and remote property checks</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">Start anywhere in India. Basera points you to reviewed official sources where available, and gives you a manual verification path everywhere else. It does not search every city plan or verify any specific property.</p>
        <p className="mt-2 text-sm text-slate-400">Source references reviewed <time dateTime={sourceReviewDate}>{sourceReviewDate}</time>. Links are starting points, not proof that a portal is currently reachable or covers the property.</p>
      </header>
      <IndiaCoveragePicker />
    </div>
  </main>;
}
