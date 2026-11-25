import { describe, expect, it } from 'vitest';
import { blankProject, compareBuyerEvidence, type LookupStatus } from '@/domain/buyerEvidence';

const listing = { registration: 'DEMO-001', project: 'Example Homes Phase 1', promoter: 'Example Pvt Ltd' };

describe('buyer evidence comparison', () => {
  it('compares entered text without mistaking case and spacing for differences', () => {
    const record = { ...listing, registration: ' demo-001 ', project: 'Example  Homes PHASE 1' };
    expect(compareBuyerEvidence(listing, record, 'record-found')).toMatchObject({
      outcome: 'entered-fields-match',
      comparison: [{ status: 'match' }, { status: 'match' }, { status: 'match' }],
    });
  });

  it('flags a different phase, even when the number and promoter match', () => {
    const record = { ...listing, project: 'Example Homes Phase 2' };
    expect(compareBuyerEvidence(listing, record, 'record-found')).toMatchObject({
      outcome: 'discrepancy',
      comparison: [{ status: 'match' }, { status: 'mismatch' }, { status: 'match' }],
    });
  });

  it('never silently treats similar corporate names or differently punctuated numbers as equal', () => {
    const record = { ...listing, registration: 'DEMO001', promoter: 'Example Holdings Pvt Ltd' };
    expect(compareBuyerEvidence(listing, record, 'record-found')).toMatchObject({
      outcome: 'discrepancy',
      comparison: [{ status: 'mismatch' }, { status: 'match' }, { status: 'mismatch' }],
    });
  });

  it('cannot reach a matching outcome with a missing field, even if it is blank on both sides', () => {
    const partial = { ...listing, promoter: ' ' };
    expect(compareBuyerEvidence(partial, partial, 'record-found')).toMatchObject({
      outcome: 'unverified',
      comparison: [{ status: 'match' }, { status: 'match' }, { status: 'unverified' }],
    });
    expect(compareBuyerEvidence(blankProject, blankProject, 'record-found').outcome).toBe('unverified');
  });

  it.each<LookupStatus>(['not-checked', 'not-found', 'portal-unavailable'])(
    'ignores entered record details without a reported official lookup: %s',
    (status) => {
      expect(compareBuyerEvidence(listing, listing, status)).toMatchObject({
        outcome: 'unverified',
        comparison: [{ status: 'unverified' }, { status: 'unverified' }, { status: 'unverified' }],
      });
    },
  );
});
