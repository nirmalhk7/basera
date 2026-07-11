export interface DynamicCityInfo {
  name: string;
  rawLocalityName?: string; // Exact name of the village/town/city for polygon searches
  state: string;
  district?: string;
  country: string;
  coordinates: [number, number]; // [lat, lng]
  elevationMeters: number;
  population?: number;
  areaEstimateSqKm?: number;
  placeType: string; // e.g., 'city', 'town', 'suburb', 'district capital'
  website?: string;
  state_planning_directorate?: string;
  town_planner_designation?: string;
  state_planning_website?: string;
  state_planning_email?: string;
  planning_authority?: string;
  town_planner_jurisdiction?: string;
  geoJsonBoundary?: any;
  planning_documents?: { title: string; url: string }[];
  state_planning_portal?: string;
  search_documents_url?: string;
  search_documents_ddg_url?: string;
  wikiSummary?: {
    extract: string;
    title: string;
    url?: string;
    thumbnailUrl?: string;
  };
  weather: {
    temperatureCelsius: number;
    apparentTemperature: number;
    relativeHumidity: number;
    windSpeedKmh: number;
    precipitationMm: number;
    weatherCode: number;
    weatherDescription: string;
    dailyMaxTemp?: number;
    dailyMinTemp?: number;
    isDay: boolean;
    fetchedAt: string;
  };
}

export type TerrainLayerId = 'esri-topo' | 'opentopomap' | 'satellite' | 'dark-relief';

export interface TerrainLayerOption {
  id: TerrainLayerId;
  name: string;
  subtitle: string;
  url: string;
  attribution: string;
  maxZoom: number;
}
