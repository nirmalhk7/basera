import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CityPlansPage from '@/app/city-plans/pune/page';
import { PlotEvidenceCheck } from '@/components/buyer/PlotEvidenceCheck';
import { plotChecks, plotVerificationProgress, type PlotEvidence } from '@/domain/puneBuyerPilot';

afterEach(cleanup);

describe('Pune planning pilot', () => {
  it('shows source scope, draft vs approved context and two distinct property workflows', () => {
    render(<CityPlansPage />);
    expect(screen.getByText(/2021 PMRDA Development Plan · Draft/)).toBeInTheDocument();
    expect(screen.getByText(/1997 Pune District Regional Plan · Approved/)).toBeInTheDocument();
    expect(screen.getByText(/area selection on the map does not establish jurisdiction/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New-build flat/i })).toHaveAttribute('href', '/buyer-check?jurisdiction=maharashtra');
    expect(screen.getByRole('link', { name: /Plot or land/i })).toHaveAttribute('href', '/buyer-check/plot?jurisdiction=maharashtra');
  });
});

describe('plot verification', () => {
  const allReviewed: PlotEvidence = Object.fromEntries(plotChecks.map(({ id }) => [id, 'reported-reviewed']));

  it('never treats missing or possibly not applicable evidence as resolved', () => {
    expect(plotVerificationProgress({})).toBe('continue-verification');
    expect(plotVerificationProgress({ ...allReviewed, planning: 'not-applicable' })).toBe('continue-verification');
  });

  it('prioritizes discrepancies and requires independent checks before payment even if all were reviewed', () => {
    expect(plotVerificationProgress({ ...allReviewed, record: 'discrepancy' })).toBe('resolve-discrepancy');
    expect(plotVerificationProgress(allReviewed)).toBe('recheck-before-payment');
  });

  it('walks a plot buyer from unknown through discrepancy and reported review without a payment clearance', () => {
    render(<PlotEvidenceCheck />);
    const progress = screen.getByRole('status');
    const record = screen.getByRole('combobox', { name: 'Identify the exact parcel' });
    expect(progress).toHaveTextContent(/continue verification only/i);

    fireEvent.change(record, { target: { value: 'discrepancy' } });
    expect(progress).toHaveTextContent(/pause payment/i);

    for (const { label } of plotChecks) {
      fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value: 'reported-reviewed' } });
    }
    expect(progress).toHaveTextContent(/not payment clearance/i);

    fireEvent.click(screen.getByRole('button', { name: /clear plot check/i }));
    expect(record).toHaveValue('unverified');
    expect(progress).toHaveTextContent(/continue verification only/i);
  });
});
