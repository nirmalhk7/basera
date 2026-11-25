import type { ResearchFeature } from '@/types/research';

export const developmentStages = [
  { key: 'existing', label: 'Existing conditions', mode: 'current', empty: 'No existing feature returned for the selected map layers. Check the site independently.' },
  { key: 'draft-plan', label: 'Draft plan', mode: 'future', empty: 'No geolocated draft plan is verified here. A draft does not establish a permit or what will be built.' },
  { key: 'adopted-plan', label: 'Adopted plan', mode: 'future', empty: 'No geolocated adopted plan is verified here. Even an adopted plan is not a building permit.' },
  { key: 'filed-proposal', label: 'Filed proposal', mode: 'future', empty: 'No geolocated filing is verified here. That does not establish that no proposal exists.' },
  { key: 'permit', label: 'Approved permit', mode: 'future', empty: 'No geolocated official permit is verified here. No map results does not mean no permit.' },
  { key: 'rule-potential', label: 'Possible under rules', mode: 'future', empty: 'No parcel-specific height, floor-space or zoning potential is verified here. A rule would not establish a known proposal.' },
] as const;

export type DevelopmentStage = typeof developmentStages[number]['key'];

export type DevelopmentRecord = Readonly<{
  stage: Exclude<DevelopmentStage, 'existing'>;
  issuer: string;
  jurisdiction: string;
  checkedOn: string;
  parcelFit: 'verified' | 'unverified' | 'conflict';
}>;

export function featureDevelopmentStage(feature: ResearchFeature): DevelopmentStage | null {
  if (feature.development && feature.mode === 'future' && feature.source.sourceType === 'official') return feature.development.stage;
  if (feature.mode === 'current' && ['operational', 'reported', 'completed'].includes(feature.status)) return 'existing';
  return null;
}

export function canMapFeature(feature: ResearchFeature): boolean {
  if (!feature.geometry) return false;
  if (!feature.development) return feature.mode === 'current';
  return featureDevelopmentStage(feature) !== null &&
    feature.development.parcelFit === 'verified' && feature.confidence.geography === 'exact';
}

export function evidenceForStage(features: readonly ResearchFeature[], stage: DevelopmentStage) {
  const matches = features.filter((feature) => featureDevelopmentStage(feature) === stage);
  return { onMap: matches.filter(canMapFeature), offMap: matches.filter((feature) => !canMapFeature(feature)) };
}
