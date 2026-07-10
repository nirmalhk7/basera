export interface DetectedPlace {
  id: string;
  name: string;
  state: string;
  district?: string;
  placeType: 'City' | 'Town' | 'Metro Area' | 'Hill Station';
  elevationMeters: number;
  coordinates: [number, number]; // [lat, lng]
  detectionRadiusKm: number;
  distanceKm?: number;
}

export const CITY_ZOOM_THRESHOLD = 8.5;

export const KNOWN_INDIAN_CITIES_INDEX: DetectedPlace[] = [
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    district: 'Mumbai City / Suburban',
    placeType: 'Metro Area',
    elevationMeters: 14,
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
    coordinates: [25.3176, 82.9739],
    detectionRadiusKm: 20
  },
  {
    id: 'surat',
    name: 'Surat',
    state: 'Gujarat',
    district: 'Surat',
    placeType: 'City',
    elevationMeters: 13,
    coordinates: [21.1702, 72.8311],
    detectionRadiusKm: 22
  },
  {
    id: 'lucknow',
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    placeType: 'City',
    elevationMeters: 123,
    coordinates: [26.8467, 80.9462],
    detectionRadiusKm: 25
  },
  {
    id: 'indore',
    name: 'Indore',
    state: 'Madhya Pradesh',
    district: 'Indore',
    placeType: 'City',
    elevationMeters: 553,
    coordinates: [22.7196, 75.8577],
    detectionRadiusKm: 22
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
