export const MAHARERA_PORTAL = 'https://maharera.maharashtra.gov.in/';

export const fields = [
  { key: 'registration', label: 'Registration number' },
  { key: 'project', label: 'Registered project or phase name' },
  { key: 'promoter', label: 'Promoter legal name' },
] as const;

type Field = typeof fields[number]['key'];
export type ProjectDetails = Record<Field, string>;
export type LookupStatus = 'not-checked' | 'record-found' | 'not-found' | 'portal-unavailable';

type FieldStatus = 'unverified' | 'match' | 'mismatch';

export const blankProject: ProjectDetails = { registration: '', project: '', promoter: '' };

function comparable(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function compareBuyerEvidence(claim: ProjectDetails, record: ProjectDetails, lookup: LookupStatus) {
  const comparison = fields.map(({ key, label }) => {
    const claimValue = comparable(claim[key]);
    const recordValue = comparable(record[key]);
    const status: FieldStatus = lookup !== 'record-found' || !claimValue || !recordValue
      ? 'unverified'
      : claimValue === recordValue ? 'match' : 'mismatch';
    return { key, label, status };
  });
  const outcome: 'discrepancy' | 'entered-fields-match' | 'unverified' = comparison.some(({ status }) => status === 'mismatch')
    ? 'discrepancy'
    : comparison.every(({ status }) => status === 'match') ? 'entered-fields-match' : 'unverified';
  return { outcome, comparison };
}
