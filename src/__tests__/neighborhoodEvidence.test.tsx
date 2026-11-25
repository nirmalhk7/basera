import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentEvidenceControls } from '@/components/research/DevelopmentEvidenceControls';
import { EvidencePanel } from '@/components/research/EvidencePanel';
import { canMapFeature, evidenceForStage } from '@/domain/neighborhoodEvidence';
import type { ResearchFeature } from '@/types/research';

afterEach(cleanup);

const filed: ResearchFeature = {
  id: 'synthetic-filed', title: 'Synthetic filed proposal', layerId: 'government_plans', mode: 'future',
  status: 'proposed', impact: 'unclear', explanation: 'Synthetic fixture, not an actual property.',
  geometry: { type: 'Point', coordinates: [73, 19] },
  confidence: { evidence: 'high', geography: 'exact' },
  source: { name: 'Synthetic citing source', url: 'https://example.invalid/source.pdf#page=12', sourceType: 'official', fetchedAt: '2026-11-24T17:00:00.000Z', reference: 'page 12' },
  development: { stage: 'filed-proposal', issuer: 'Synthetic planning office', jurisdiction: 'Test jurisdiction', checkedOn: '2026-11-24', parcelFit: 'verified' },
};
const permit: ResearchFeature = {
  ...filed, id: 'synthetic-permit', title: 'Synthetic permit', status: 'approved',
  development: { ...filed.development!, stage: 'permit', parcelFit: 'conflict' },
};
const potential: ResearchFeature = {
  ...filed, id: 'synthetic-rule', title: 'Synthetic rules potential', geometry: undefined,
  development: { ...filed.development!, stage: 'rule-potential', parcelFit: 'unverified' },
};

describe('development evidence filter', () => {
  it('separates adopted plan, filed proposal, permit, and potential without inventing geometry', () => {
    const adopted: ResearchFeature = { ...filed, id: 'synthetic-adopted', development: { ...filed.development!, stage: 'adopted-plan' } };
    const features = [filed, permit, potential, adopted];
    expect(evidenceForStage(features, 'filed-proposal')).toEqual({ onMap: [filed], offMap: [] });
    expect(evidenceForStage(features, 'adopted-plan')).toEqual({ onMap: [adopted], offMap: [] });
    expect(evidenceForStage(features, 'permit')).toEqual({ onMap: [], offMap: [permit] });
    expect(evidenceForStage(features, 'rule-potential')).toEqual({ onMap: [], offMap: [potential] });
    expect(canMapFeature({ ...filed, development: undefined })).toBe(false);
    expect(canMapFeature({ ...filed, source: { ...filed.source, sourceType: 'community' } })).toBe(false);
  });

  it('opens nonspatial records by button and labels empty stages as unverified', () => {
    const onStage = vi.fn();
    const onSelect = vi.fn();
    render(<DevelopmentEvidenceControls stage="rule-potential" onStage={onStage} onMap={[]} offMap={[potential]} onSelect={onSelect} confirmed />);
    expect(screen.getByRole('button', { name: 'Possible under rules' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/No parcel-specific/i);
    expect(screen.getByText(/geometry or exact parcel match is unverified/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approved permit' }));
    expect(onStage).toHaveBeenCalledWith('permit');
    fireEvent.click(screen.getByRole('button', { name: potential.title }));
    expect(onSelect).toHaveBeenCalledWith(potential);
  });

  it('shows date, issuer, jurisdiction, citation page, and no inferred building in the inspector', () => {
    render(<EvidencePanel feature={potential} areaLabel="Synthetic area" />);
    expect(screen.getByText(/Issuer: Synthetic planning office/)).toHaveTextContent('Test jurisdiction · Checked: 2026-11-24 · Parcel fit: unverified');
    expect(screen.getByText('Document reference: page 12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open original source' })).toHaveAttribute('href', 'https://example.invalid/source.pdf#page=12');
    expect(screen.getByText(/No known proposal, building height or future massing/)).toBeInTheDocument();
  });
});
