import type { LayerDefinition } from '@/types/research';

const OPENSTREETMAP = {
  name: 'OpenStreetMap',
  description: 'OpenStreetMap feature data queried with the applicable tags for the selected area.',
  url: 'https://www.openstreetmap.org/',
} as const;

export const RESEARCH_LAYERS: readonly LayerDefinition[] = [
  {
    id: 'transport',
    name: 'Public transport',
    description: 'Public-transport infrastructure and access points mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'roads',
    name: 'Road network',
    description: 'Road and street network features mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Healthcare facilities mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'education',
    name: 'Education',
    description: 'Educational facilities mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'daily_needs',
    name: 'Daily needs',
    description: 'Supermarkets, convenience stores, department stores, malls, and marketplaces mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'emergency',
    name: 'Emergency services',
    description: 'Police, fire, ambulance, and emergency-capable hospitals mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'parks',
    name: 'Parks and recreation',
    description: 'Parks and recreation areas mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'recreation',
    name: 'Sports and recreation',
    description: 'Sports centres, stadiums, pools, pitches, fitness centres, and recreation grounds mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'civic',
    name: 'Civic services',
    description: 'Civic and public-service features mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    description: 'Power substations and plants, water works, towers, and pumping stations mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'water',
    name: 'Water features',
    description: 'Surface-water and waterway features mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'land_use',
    name: 'Land use',
    description: 'Land-use areas mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'industrial_waste',
    name: 'Industrial and waste',
    description: 'Industrial areas, works, landfills, waste facilities, and wastewater plants mapped in OpenStreetMap.',
    supportedModes: ['current'],
    sourceRequirements: [OPENSTREETMAP],
  },
  {
    id: 'flood',
    name: 'Flood risk',
    description: 'Flood-risk research requires authoritative hydrological or hazard data.',
    supportedModes: [],
    sourceRequirements: [
      {
        name: 'Central Water Commission',
        description: 'Area-resolved flood forecasts, inundation records, or hazard mapping.',
        url: 'https://cwc.gov.in/',
      },
    ],
  },
  {
    id: 'air_quality',
    name: 'Air quality',
    description: 'Air-quality research requires time-stamped monitoring observations for the area.',
    supportedModes: [],
    sourceRequirements: [
      {
        name: 'Central Pollution Control Board',
        description: 'Geolocated monitoring observations and their measurement metadata.',
        url: 'https://cpcb.nic.in/',
      },
    ],
  },
  {
    id: 'environmental_clearances',
    name: 'Environmental clearances',
    description: 'Clearance research requires official project and decision records.',
    supportedModes: [],
    sourceRequirements: [
      {
        name: 'PARIVESH',
        description: 'Official environmental clearance project records and decision documents.',
        url: 'https://parivesh.nic.in/',
      },
    ],
  },
  {
    id: 'government_plans',
    name: 'Government plans',
    description: 'Planning research requires published plans from the responsible government body.',
    supportedModes: [],
    sourceRequirements: [
      {
        name: 'Responsible planning authority',
        description: 'Official master plans, notifications, maps, and accompanying publications.',
      },
    ],
  },
] as const;

export function getResearchLayer(layerId: LayerDefinition['id']): LayerDefinition | undefined {
  return RESEARCH_LAYERS.find((layer) => layer.id === layerId);
}
