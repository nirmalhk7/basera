import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IndiaCoveragePicker } from '@/components/buyer/IndiaCoveragePicker';
import { resolveJurisdiction, statesAndTerritories } from '@/domain/indiaCoverage';

afterEach(cleanup);

describe('all India coverage entry', () => {
  it('covers 28 states and 8 union territories without guessing free-text or duplicate jurisdictions', () => {
    expect(new Set(statesAndTerritories.map(([key]) => key)).size).toBe(36);
    expect(resolveJurisdiction('Delhi NCR')).toBeNull();
    expect(resolveJurisdiction(['delhi', 'haryana'])).toBeNull();
    expect(resolveJurisdiction('haryana')?.planning).toBeUndefined();
  });

  it.each([
    ['maharashtra', /Pune metropolitan region/, 'https://www.pmrda.gov.in/en/development-plan/'],
    ['karnataka', /Bengaluru/, 'https://bengaluruurban.nic.in/en/department/bangalore-development-authority/'],
    ['telangana', /Hyderabad metropolitan region/, 'https://www.hmda.gov.in/master-planning-2031/'],
    ['delhi', /Delhi \(NCT\)/, 'https://dda.gov.in/master-plan'],
    ['tamil-nadu', /Chennai metropolitan area/, 'https://cmdachennai.gov.in/pdfs/VariationApprovedSMP.pdf'],
  ])('only shows the reviewed planning path for %s after city or area selection', (state, area, href) => {
    render(<IndiaCoveragePicker />);
    fireEvent.change(screen.getByLabelText('State or union territory'), { target: { value: state } });
    expect(screen.getByText(/No city planning source selected/)).toBeInTheDocument();
    const select = screen.getByLabelText('Is the property in this area?');
    expect(select).toHaveTextContent(area);
    fireEvent.change(select, { target: { value: 'matches' } });
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === href)).toBe(true);
    expect(screen.getByRole('link', { name: /New-build flat check/i }).getAttribute('href')).toBe(`/buyer-check?jurisdiction=${state}`);
    fireEvent.change(select, { target: { value: 'other' } });
    expect(screen.getByText(/No city planning source selected/)).toBeInTheDocument();
  });

  it('keeps the unresolved path usable and resets the city when state changes', () => {
    render(<IndiaCoveragePicker />);
    expect(screen.getByRole('link', { name: /New-build flat check/i })).toHaveAttribute('href', '/buyer-check');
    const state = screen.getByLabelText('State or union territory');
    fireEvent.change(state, { target: { value: 'delhi' } });
    fireEvent.change(screen.getByLabelText('Is the property in this area?'), { target: { value: 'matches' } });
    expect(screen.getByRole('link', { name: /Delhi Master Plan index/i })).toBeInTheDocument();
    fireEvent.change(state, { target: { value: 'haryana' } });
    expect(screen.queryByRole('link', { name: /Delhi Master Plan index/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /National RERA authority directory/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Plot or land checklist/i })).toHaveAttribute('href', '/buyer-check/plot?jurisdiction=haryana');
  });
});
