export const sourceReviewDate = '2026-11-24';

export const puneSources = {
  planning: {
    name: 'PMRDA Development Plan and certificates',
    issuer: 'Pune Metropolitan Region Development Authority',
    href: 'https://www.pmrda.gov.in/en/development-plan/',
  },
  planningStatus: {
    name: 'PMRDA Development Permission guidance',
    issuer: 'Pune Metropolitan Region Development Authority',
    href: 'https://www.pmrda.gov.in/en/development-permission/',
  },
  land: {
    name: 'Mahabhumi land records and e-Mojni',
    issuer: 'Maharashtra Land Records Department',
    href: 'https://mahabhumi.gov.in/Mahabhumilink/',
  },
  cadastral: {
    name: 'Maharashtra BhuNaksha cadastral map',
    issuer: 'Maharashtra Land Records Department',
    href: 'https://mahabhunakasha.mahabhumi.gov.in/27/index.jsp',
  },
} as const;

export const plotChecks = [
  { id: 'record', label: 'Identify the exact parcel', source: 'land', detail: 'Use the official locality and parcel identifier required by the local records office. Ask your lawyer which land record applies, then compare it with the proposed agreement.' },
  { id: 'boundary', label: 'Check boundaries and access on site', source: 'cadastral', detail: 'Ask an independent surveyor licensed or authorized for the area to compare the records, official measurement and physical boundaries. Check access and encroachments; an area map is not a parcel survey.' },
  { id: 'planning', label: 'Confirm the parcel’s planning authority and applicable plan', source: 'planning', detail: 'Ask the authority to confirm the applicable plan, amendments, reservations, and the parcel’s relevant zone or part-plan record.' },
  { id: 'legal', label: 'Check title, seller authority and the payment request', source: null, detail: 'Ask an independent local property lawyer to review title chain, encumbrances, access rights, seller authority, applicable permissions, and payment instructions. For a plot sold as part of a development, ask whether project registration applies. Verify the payee through a separately obtained contact.' },
] as const;

export const evidenceStatuses = ['unverified', 'reported-reviewed', 'discrepancy', 'not-applicable'] as const;
export type EvidenceStatus = typeof evidenceStatuses[number];
export type PlotCheckId = typeof plotChecks[number]['id'];
export type PlotEvidence = Partial<Record<PlotCheckId, EvidenceStatus>>;

export function plotVerificationProgress(evidence: PlotEvidence) {
  if (plotChecks.some(({ id }) => evidence[id] === 'discrepancy')) return 'resolve-discrepancy';
  if (plotChecks.every(({ id }) => evidence[id] === 'reported-reviewed')) return 'recheck-before-payment';
  // A user saying "not applicable" cannot waive an essential parcel check.
  return 'continue-verification';
}
