import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BuyerEvidenceCheck } from '@/components/buyer/BuyerEvidenceCheck';

function fillProject(group: HTMLElement, project: string) {
  const field = within(group);
  fireEvent.change(field.getByLabelText('Registration number'), { target: { value: 'DEMO-001' } });
  fireEvent.change(field.getByLabelText('Registered project or phase name'), { target: { value: project } });
  fireEvent.change(field.getByLabelText('Promoter legal name'), { target: { value: 'Example Promoter' } });
}

function lookup(value: string) {
  fireEvent.change(screen.getByLabelText('What happened in your lookup?'), { target: { value } });
}

describe('remote buyer workflow', () => {
  it('links to the official portal without inserting buyer-entered details in the URL', () => {
    render(<BuyerEvidenceCheck />);
    fillProject(screen.getByRole('group', { name: /what the listing says/i }), 'Synthetic phase 1');
    expect(screen.getByRole('link', { name: /official MahaRERA portal/i })).toHaveAttribute(
      'href', 'https://maharera.maharashtra.gov.in/',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Not enough evidence');
    expect(screen.queryByRole('group', { name: /copy only/i })).not.toBeInTheDocument();
  });

  it('flags a different phase and gives no purchase clearance even after the text is corrected', () => {
    render(<BuyerEvidenceCheck />);
    fillProject(screen.getByRole('group', { name: /what the listing says/i }), 'Synthetic phase 1');
    lookup('record-found');
    const record = screen.getByRole('group', { name: /copy only/i });
    fillProject(record, 'Synthetic phase 2');
    expect(screen.getByRole('status')).toHaveTextContent('Pause: the entered details differ');
    expect(screen.getByText('Different text')).toBeInTheDocument();
    fillProject(record, 'Synthetic phase 1');
    expect(screen.getByRole('status')).toHaveTextContent('Entered details match. Keep checking.');
    expect(screen.getByRole('status')).toHaveTextContent('not independent verification');
  });

  it('reverts to unverified and discards previous record entries after a new failed lookup', () => {
    render(<BuyerEvidenceCheck />);
    fillProject(screen.getByRole('group', { name: /what the listing says/i }), 'Synthetic phase 1');
    lookup('record-found');
    fillProject(screen.getByRole('group', { name: /copy only/i }), 'Synthetic phase 1');
    lookup('portal-unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('Not enough evidence');
    lookup('record-found');
    const record = within(screen.getByRole('group', { name: /copy only/i }));
    expect(record.getByLabelText('Registration number')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Not enough evidence');
  });

  it('can clear both sets of entries and reset the lookup', () => {
    render(<BuyerEvidenceCheck />);
    fillProject(screen.getByRole('group', { name: /what the listing says/i }), 'Synthetic phase 1');
    lookup('record-found');
    fillProject(screen.getByRole('group', { name: /copy only/i }), 'Synthetic phase 1');
    fireEvent.click(screen.getByRole('button', { name: /clear this check/i }));
    const listing = within(screen.getByRole('group', { name: /what the listing says/i }));
    expect(listing.getByLabelText('Registration number')).toHaveValue('');
    expect(screen.getByLabelText('What happened in your lookup?')).toHaveValue('not-checked');
    expect(screen.queryByRole('group', { name: /copy only/i })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Not enough evidence');
  });
});
