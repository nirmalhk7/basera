/** GeoJSON positions use [longitude, latitude] order. */
export type GeoPosition = readonly [longitude: number, latitude: number];

export type LinearRing = readonly GeoPosition[];

export interface PolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: readonly LinearRing[];
}

export interface MultiPolygonGeometry {
  readonly type: 'MultiPolygon';
  readonly coordinates: readonly (readonly LinearRing[])[];
}

export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface PointGeometry {
  readonly type: 'Point';
  readonly coordinates: GeoPosition;
}

export interface LineStringGeometry {
  readonly type: 'LineString';
  readonly coordinates: readonly GeoPosition[];
}

export interface MultiLineStringGeometry {
  readonly type: 'MultiLineString';
  readonly coordinates: readonly (readonly GeoPosition[])[];
}

export type ResearchGeometry =
  | PointGeometry
  | LineStringGeometry
  | PolygonGeometry
  | MultiLineStringGeometry
  | MultiPolygonGeometry;

/** GeoJSON order: [west, south, east, north]. */
export type BoundingBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];

export type ResearchMode = 'current' | 'future';

export type CoverageLevel = 'strong' | 'partial' | 'weak' | 'unavailable' | 'failed';

export type LayerId =
  | 'transport'
  | 'roads'
  | 'healthcare'
  | 'education'
  | 'daily_needs'
  | 'emergency'
  | 'parks'
  | 'recreation'
  | 'civic'
  | 'utilities'
  | 'water'
  | 'land_use'
  | 'industrial_waste'
  | 'flood'
  | 'air_quality'
  | 'environmental_clearances'
  | 'government_plans';

export type FeatureStatus =
  | 'operational'
  | 'reported'
  | 'proposed'
  | 'consultation'
  | 'notified'
  | 'approved'
  | 'funded'
  | 'tendered'
  | 'construction'
  | 'delayed'
  | 'cancelled'
  | 'completed'
  | 'unavailable'
  | 'failed';

export type ImpactDirection = 'positive' | 'negative' | 'mixed' | 'unclear';

export interface SourceReference {
  readonly name: string;
  readonly url: string;
}

export interface SourceRequirement {
  readonly name: string;
  readonly description: string;
  readonly url?: string;
}

export interface AreaSelection {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  /** ISO 3166-1 alpha-2 country code supplied by the area resolver, when available. */
  readonly countryCode?: string;
  readonly state?: string;
  readonly district?: string;
  readonly source: SourceReference;
  readonly geometry: AreaGeometry;
  readonly bbox: BoundingBox;
}

export type AreaSearchResult = AreaSelection;

export interface LayerDefinition {
  readonly id: LayerId;
  readonly name: string;
  readonly description: string;
  /** Modes with a configured source adapter, not a guarantee of area-level coverage. */
  readonly supportedModes: readonly ResearchMode[];
  /** Source metadata needed before a query may return feature evidence. */
  readonly sourceRequirements: readonly SourceRequirement[];
}

export interface SourceEvidence extends SourceReference {
  readonly sourceType: 'official' | 'community' | 'news' | 'research' | 'company';
  readonly fetchedAt: string;
  readonly publishedAt?: string;
  readonly reference?: string;
}

export interface ResearchAttribute {
  readonly label: string;
  readonly value: string;
}

export interface ResearchFeature {
  readonly id: string;
  readonly layerId: LayerId;
  readonly title: string;
  readonly geometry?: ResearchGeometry;
  readonly mode: ResearchMode;
  readonly status: FeatureStatus;
  readonly impact: ImpactDirection;
  readonly explanation: string;
  /** Selected, source-provided OSM tags. Values are displayed as text, never executed. */
  readonly attributes?: readonly ResearchAttribute[];
  readonly source: SourceEvidence;
  readonly confidence: {
    readonly evidence: 'high' | 'medium' | 'low';
    readonly geography: 'exact' | 'approximate' | 'area-wide';
  };
}

export interface LayerCoverage {
  readonly layerId: LayerId;
  readonly level: CoverageLevel;
  readonly message: string;
  readonly sourcesChecked: readonly SourceReference[];
  readonly sourcesSucceeded: readonly SourceReference[];
}

export interface LayerResult {
  readonly layerId: LayerId;
  readonly features: readonly ResearchFeature[];
  readonly coverage: LayerCoverage;
}

export interface LayerQueryRequest {
  /** Canonical Nominatim-backed Polygon or MultiPolygon identity: osm:relation/<id> or osm:way/<id>. */
  readonly areaId: string;
  readonly mode: ResearchMode;
  readonly layerIds: readonly LayerId[];
}

export interface LayerQueryResponse {
  readonly area: AreaSelection;
  readonly mode: ResearchMode;
  readonly layers: readonly LayerResult[];
  readonly generatedAt: string;
}
