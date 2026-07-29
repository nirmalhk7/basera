import { describe, expect, it } from 'vitest';
import { RESEARCH_LAYERS, getResearchLayer } from '@/config/researchLayers';
import type { LayerId } from '@/types/research';

const EXPECTED_LAYER_IDS: readonly LayerId[] = [
  'transport',
  'roads',
  'healthcare',
  'education',
  'daily_needs',
  'emergency',
  'parks',
  'recreation',
  'civic',
  'utilities',
  'water',
  'land_use',
  'industrial_waste',
  'flood',
  'air_quality',
  'environmental_clearances',
  'government_plans',
];

describe('research layer catalog', () => {
  it('defines every Phase 1 research category exactly once', () => {
    expect(RESEARCH_LAYERS.map((layer) => layer.id)).toEqual(EXPECTED_LAYER_IDS);
  });

  it('identifies the current OpenStreetMap-backed layer adapters', () => {
    const currentLayers = RESEARCH_LAYERS.filter((layer) => layer.supportedModes.includes('current'));

    expect(currentLayers.map((layer) => layer.id)).toEqual([
      'transport',
      'roads',
      'healthcare',
      'education',
      'daily_needs',
      'emergency',
      'parks',
      'recreation',
      'civic',
      'utilities',
      'water',
      'land_use',
      'industrial_waste',
    ]);
    expect(currentLayers.every((layer) => layer.sourceRequirements[0]?.name === 'OpenStreetMap')).toBe(true);
  });

  it('retains unsupported future categories as source requirements, without feature adapters', () => {
    const unsupportedLayers = RESEARCH_LAYERS.filter((layer) => layer.supportedModes.length === 0);

    expect(unsupportedLayers.map((layer) => layer.id)).toEqual([
      'flood',
      'air_quality',
      'environmental_clearances',
      'government_plans',
    ]);
    expect(unsupportedLayers.every((layer) => layer.sourceRequirements.length > 0)).toBe(true);
    expect(getResearchLayer('flood')?.supportedModes).toEqual([]);
    expect(getResearchLayer('not-a-layer' as LayerId)).toBeUndefined();
  });
});
