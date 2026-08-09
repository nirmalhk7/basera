import type { GeoJsonObject } from 'geojson';

export const INDIA_BOUNDS_COORDS = {
  southWest: [4.5, 58.0] as [number, number],
  northEast: [39.0, 99.5] as [number, number]
};

/**
 * Checks if a coordinate is strictly within India's geographical bounding box
 */
export function isCoordinateWithinIndiaBounds(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_BOUNDS_COORDS.southWest[0] &&
    lat <= INDIA_BOUNDS_COORDS.northEast[0] &&
    lng >= INDIA_BOUNDS_COORDS.southWest[1] &&
    lng <= INDIA_BOUNDS_COORDS.northEast[1]
  );
}

export interface MonthlyClimate {
  month: string;
  high: number; // °C
  low: number; // °C
}

export interface DetectedPlace {
  id: string;
  name: string;
  state: string;
  district?: string;
  placeType: 'City' | 'Town' | 'District' | 'Taluka' | 'Metro Area' | 'Hill Station';
  elevationMeters: number;
  populationEstimate: string; // e.g. "21.6 Million"
  monthlyClimate: MonthlyClimate[];
  coordinates: [number, number]; // [lat, lng]
  detectionRadiusKm: number;
  distanceKm?: number;
  geoJsonBoundary?: GeoJsonObject; // GeoJSON Polygon or MultiPolygon
}

export const CITY_ZOOM_THRESHOLD = 8.5;

// Standard 12 months helper
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const KNOWN_INDIAN_CITIES_INDEX: DetectedPlace[] = [
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    district: 'Mumbai City / Suburban',
    placeType: 'Metro Area',
    elevationMeters: 14,
    populationEstimate: '21.3 Million',
    monthlyClimate: [
      { month: 'Jan', high: 31, low: 18 },
      { month: 'Feb', high: 31, low: 19 },
      { month: 'Mar', high: 33, low: 22 },
      { month: 'Apr', high: 33, low: 25 },
      { month: 'May', high: 34, low: 27 },
      { month: 'Jun', high: 32, low: 27 },
      { month: 'Jul', high: 30, low: 26 },
      { month: 'Aug', high: 30, low: 25 },
      { month: 'Sep', high: 31, low: 25 },
      { month: 'Oct', high: 33, low: 24 },
      { month: 'Nov', high: 34, low: 22 },
      { month: 'Dec', high: 32, low: 19 }
    ],
    coordinates: [19.076, 72.8777],
    detectionRadiusKm: 35
  },
  {
    id: 'delhi',
    name: 'New Delhi',
    state: 'National Capital Territory of Delhi',
    district: 'New Delhi',
    placeType: 'Metro Area',
    elevationMeters: 216,
    populationEstimate: '33.8 Million',
    monthlyClimate: [
      { month: 'Jan', high: 20, low: 8 },
      { month: 'Feb', high: 24, low: 11 },
      { month: 'Mar', high: 30, low: 16 },
      { month: 'Apr', high: 37, low: 22 },
      { month: 'May', high: 40, low: 27 },
      { month: 'Jun', high: 39, low: 28 },
      { month: 'Jul', high: 35, low: 28 },
      { month: 'Aug', high: 34, low: 27 },
      { month: 'Sep', high: 34, low: 25 },
      { month: 'Oct', high: 33, low: 20 },
      { month: 'Nov', high: 28, low: 13 },
      { month: 'Dec', high: 22, low: 8 }
    ],
    coordinates: [28.6139, 77.209],
    detectionRadiusKm: 35
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    placeType: 'Metro Area',
    elevationMeters: 920,
    populationEstimate: '13.6 Million',
    monthlyClimate: [
      { month: 'Jan', high: 28, low: 16 },
      { month: 'Feb', high: 31, low: 18 },
      { month: 'Mar', high: 34, low: 20 },
      { month: 'Apr', high: 35, low: 22 },
      { month: 'May', high: 33, low: 22 },
      { month: 'Jun', high: 29, low: 20 },
      { month: 'Jul', high: 28, low: 20 },
      { month: 'Aug', high: 28, low: 20 },
      { month: 'Sep', high: 28, low: 20 },
      { month: 'Oct', high: 28, low: 19 },
      { month: 'Nov', high: 27, low: 18 },
      { month: 'Dec', high: 26, low: 16 }
    ],
    coordinates: [12.9716, 77.5946],
    detectionRadiusKm: 30
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    district: 'Kolkata',
    placeType: 'Metro Area',
    elevationMeters: 9,
    populationEstimate: '15.3 Million',
    monthlyClimate: [
      { month: 'Jan', high: 26, low: 14 },
      { month: 'Feb', high: 29, low: 17 },
      { month: 'Mar', high: 34, low: 22 },
      { month: 'Apr', high: 36, low: 25 },
      { month: 'May', high: 36, low: 27 },
      { month: 'Jun', high: 34, low: 27 },
      { month: 'Jul', high: 32, low: 27 },
      { month: 'Aug', high: 32, low: 27 },
      { month: 'Sep', high: 32, low: 26 },
      { month: 'Oct', high: 32, low: 24 },
      { month: 'Nov', high: 30, low: 19 },
      { month: 'Dec', high: 27, low: 15 }
    ],
    coordinates: [22.5726, 88.3639],
    detectionRadiusKm: 30
  },
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    district: 'Chennai',
    placeType: 'Metro Area',
    elevationMeters: 6,
    populationEstimate: '11.8 Million',
    monthlyClimate: [
      { month: 'Jan', high: 29, low: 21 },
      { month: 'Feb', high: 31, low: 22 },
      { month: 'Mar', high: 33, low: 24 },
      { month: 'Apr', high: 35, low: 26 },
      { month: 'May', high: 37, low: 28 },
      { month: 'Jun', high: 37, low: 28 },
      { month: 'Jul', high: 35, low: 26 },
      { month: 'Aug', high: 35, low: 26 },
      { month: 'Sep', high: 34, low: 26 },
      { month: 'Oct', high: 32, low: 25 },
      { month: 'Nov', high: 30, low: 23 },
      { month: 'Dec', high: 29, low: 22 }
    ],
    coordinates: [13.0827, 80.2707],
    detectionRadiusKm: 30
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    district: 'Hyderabad',
    placeType: 'Metro Area',
    elevationMeters: 542,
    populationEstimate: '10.8 Million',
    monthlyClimate: [
      { month: 'Jan', high: 29, low: 15 },
      { month: 'Feb', high: 32, low: 18 },
      { month: 'Mar', high: 36, low: 21 },
      { month: 'Apr', high: 39, low: 25 },
      { month: 'May', high: 40, low: 27 },
      { month: 'Jun', high: 34, low: 24 },
      { month: 'Jul', high: 31, low: 23 },
      { month: 'Aug', high: 30, low: 22 },
      { month: 'Sep', high: 31, low: 22 },
      { month: 'Oct', high: 31, low: 20 },
      { month: 'Nov', high: 29, low: 17 },
      { month: 'Dec', high: 28, low: 14 }
    ],
    coordinates: [17.385, 78.4867],
    detectionRadiusKm: 30
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    state: 'Gujarat',
    district: 'Ahmedabad',
    placeType: 'City',
    elevationMeters: 53,
    populationEstimate: '8.6 Million',
    monthlyClimate: [
      { month: 'Jan', high: 28, low: 13 },
      { month: 'Feb', high: 31, low: 15 },
      { month: 'Mar', high: 36, low: 20 },
      { month: 'Apr', high: 40, low: 24 },
      { month: 'May', high: 42, low: 27 },
      { month: 'Jun', high: 39, low: 28 },
      { month: 'Jul', high: 34, low: 26 },
      { month: 'Aug', high: 32, low: 25 },
      { month: 'Sep', high: 33, low: 25 },
      { month: 'Oct', high: 36, low: 22 },
      { month: 'Nov', high: 33, low: 17 },
      { month: 'Dec', high: 29, low: 13 }
    ],
    coordinates: [23.0225, 72.5714],
    detectionRadiusKm: 25
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    district: 'Pune',
    placeType: 'City',
    elevationMeters: 560,
    populationEstimate: '7.1 Million',
    monthlyClimate: [
      { month: 'Jan', high: 30, low: 12 },
      { month: 'Feb', high: 33, low: 13 },
      { month: 'Mar', high: 36, low: 17 },
      { month: 'Apr', high: 38, low: 21 },
      { month: 'May', high: 37, low: 23 },
      { month: 'Jun', high: 32, low: 23 },
      { month: 'Jul', high: 28, low: 22 },
      { month: 'Aug', high: 28, low: 21 },
      { month: 'Sep', high: 29, low: 21 },
      { month: 'Oct', high: 32, low: 19 },
      { month: 'Nov', high: 31, low: 15 },
      { month: 'Dec', high: 29, low: 12 }
    ],
    coordinates: [18.5204, 73.8567],
    detectionRadiusKm: 25
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    district: 'Jaipur',
    placeType: 'City',
    elevationMeters: 431,
    populationEstimate: '4.2 Million',
    monthlyClimate: [
      { month: 'Jan', high: 22, low: 8 },
      { month: 'Feb', high: 26, low: 11 },
      { month: 'Mar', high: 32, low: 16 },
      { month: 'Apr', high: 38, low: 22 },
      { month: 'May', high: 41, low: 26 },
      { month: 'Jun', high: 40, low: 28 },
      { month: 'Jul', high: 34, low: 26 },
      { month: 'Aug', high: 32, low: 25 },
      { month: 'Sep', high: 33, low: 24 },
      { month: 'Oct', high: 34, low: 19 },
      { month: 'Nov', high: 29, low: 13 },
      { month: 'Dec', high: 24, low: 9 }
    ],
    coordinates: [26.9124, 75.7873],
    detectionRadiusKm: 25
  },
  {
    id: 'srinagar',
    name: 'Srinagar',
    state: 'Jammu and Kashmir',
    district: 'Srinagar',
    placeType: 'City',
    elevationMeters: 1585,
    populationEstimate: '1.6 Million',
    monthlyClimate: [
      { month: 'Jan', high: 7, low: -2 },
      { month: 'Feb', high: 10, low: 1 },
      { month: 'Mar', high: 15, low: 4 },
      { month: 'Apr', high: 21, low: 8 },
      { month: 'May', high: 25, low: 11 },
      { month: 'Jun', high: 30, low: 15 },
      { month: 'Jul', high: 31, low: 18 },
      { month: 'Aug', high: 30, low: 18 },
      { month: 'Sep', high: 28, low: 13 },
      { month: 'Oct', high: 22, low: 6 },
      { month: 'Nov', high: 16, low: 1 },
      { month: 'Dec', high: 9, low: -2 }
    ],
    coordinates: [34.0837, 74.7973],
    detectionRadiusKm: 20
  },
  {
    id: 'leh',
    name: 'Leh',
    state: 'Ladakh',
    district: 'Leh',
    placeType: 'Hill Station',
    elevationMeters: 3524,
    populationEstimate: '45,000',
    monthlyClimate: [
      { month: 'Jan', high: -2, low: -14 },
      { month: 'Feb', high: 1, low: -11 },
      { month: 'Mar', high: 6, low: -5 },
      { month: 'Apr', high: 12, low: 0 },
      { month: 'May', high: 16, low: 3 },
      { month: 'Jun', high: 21, low: 7 },
      { month: 'Jul', high: 25, low: 10 },
      { month: 'Aug', high: 25, low: 10 },
      { month: 'Sep', high: 21, low: 5 },
      { month: 'Oct', high: 14, low: -1 },
      { month: 'Nov', high: 7, low: -6 },
      { month: 'Dec', high: 2, low: -11 }
    ],
    coordinates: [34.1526, 77.5771],
    detectionRadiusKm: 20
  },
  {
    id: 'kochi',
    name: 'Kochi',
    state: 'Kerala',
    district: 'Ernakulam',
    placeType: 'City',
    elevationMeters: 2,
    populationEstimate: '3.3 Million',
    monthlyClimate: [
      { month: 'Jan', high: 32, low: 23 },
      { month: 'Feb', high: 32, low: 24 },
      { month: 'Mar', high: 32, low: 26 },
      { month: 'Apr', high: 33, low: 26 },
      { month: 'May', high: 32, low: 26 },
      { month: 'Jun', high: 29, low: 24 },
      { month: 'Jul', high: 29, low: 24 },
      { month: 'Aug', high: 29, low: 24 },
      { month: 'Sep', high: 30, low: 24 },
      { month: 'Oct', high: 30, low: 24 },
      { month: 'Nov', high: 31, low: 24 },
      { month: 'Dec', high: 32, low: 23 }
    ],
    coordinates: [9.9312, 76.2673],
    detectionRadiusKm: 22
  },
  {
    id: 'varanasi',
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    placeType: 'City',
    elevationMeters: 81,
    populationEstimate: '1.7 Million',
    monthlyClimate: [
      { month: 'Jan', high: 23, low: 9 },
      { month: 'Feb', high: 26, low: 12 },
      { month: 'Mar', high: 33, low: 17 },
      { month: 'Apr', high: 39, low: 23 },
      { month: 'May', high: 41, low: 27 },
      { month: 'Jun', high: 39, low: 28 },
      { month: 'Jul', high: 34, low: 26 },
      { month: 'Aug', high: 33, low: 26 },
      { month: 'Sep', high: 33, low: 25 },
      { month: 'Oct', high: 33, low: 20 },
      { month: 'Nov', high: 29, low: 14 },
      { month: 'Dec', high: 24, low: 10 }
    ],
    coordinates: [25.3176, 82.9739],
    detectionRadiusKm: 20
  }
];

/**
 * Haversine formula to compute distance in km between two lat/lng coordinates
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Determine the administrative detection level based on map zoom magnification
 */
export function getAdministrativeDetectionLevel(zoomLevel: number): string {
  if (zoomLevel >= 13) return 'Taluka / Ward Level';
  if (zoomLevel >= 11) return 'Town / Municipal Level';
  if (zoomLevel >= 9) return 'City / Metro Level';
  if (zoomLevel >= 7.5) return 'District Level';
  return 'Regional Level';
}

/**
 * Generates an estimated monthly climate profile based on latitude and altitude
 * for dynamically detected towns/cities not in our hardcoded index.
 */
export function estimateMonthlyClimate(lat: number, elevationMeters: number = 50): MonthlyClimate[] {
  // Approximate lapse rate adjustment (-6.5 deg C per 1000m)
  const altitudeAdj = -(elevationMeters / 1000) * 6.5;
  // Latitude base temperature
  const baseTemp = 32 - Math.max(0, (lat - 15) * 0.45) + altitudeAdj;

  return MONTHS.map((month, idx) => {
    // Winter (Jan=0, Dec=11) cooler, May/Jun (4,5) warmest
    let seasonalOffset = 0;
    if (idx === 4 || idx === 5) seasonalOffset = 6;
    else if (idx === 3 || idx === 6) seasonalOffset = 4;
    else if (idx === 0 || idx === 11) seasonalOffset = -5;
    else if (idx === 1) seasonalOffset = -3;

    const high = Math.round(baseTemp + seasonalOffset);
    const low = Math.round(high - 10);
    return { month, high, low };
  });
}

/**
 * Fetch actual GeoJSON boundary polygon of a place/district from OpenStreetMap Nominatim API
 */
export async function fetchPlaceGeoJSONBoundary(placeName: string, lat: number, lon: number): Promise<any | null> {
  try {
    // We try to query exactly the provided name (e.g. "Khadki", "Pune Municipal Corporation")
    // without forcing it to be a "district".
    const url = `/api/nominatim?path=search&q=${encodeURIComponent(
      placeName + ', India'
    )}&format=json&polygon_geojson=1&limit=3`;
    
    const res = await fetch(url);
    
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          if (item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon')) {
            return item.geojson as GeoJsonObject;
          }
        }
      }
    }
  } catch (err) {
    console.warn('GeoJSON boundary fetch error:', err);
  }
  return null;
}

/**
 * Geospatial detection layer that checks if the viewport center at current zoom level
 * is zoomed into a particular city or town.
 */
export function detectCityAtCoordinates(
  lat: number,
  lng: number,
  zoomLevel: number
): DetectedPlace | null {
  if (zoomLevel < CITY_ZOOM_THRESHOLD) {
    return null;
  }

  let closestPlace: DetectedPlace | null = null;
  let minDistance = Infinity;

  for (const place of KNOWN_INDIAN_CITIES_INDEX) {
    const dist = calculateHaversineDistanceKm(
      lat,
      lng,
      place.coordinates[0],
      place.coordinates[1]
    );
    if (dist <= place.detectionRadiusKm && dist < minDistance) {
      minDistance = dist;
      closestPlace = {
        ...place,
        distanceKm: dist
      };
    }
  }

  return closestPlace;
}
