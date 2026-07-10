import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  detectCityAtCoordinates,
  CITY_ZOOM_THRESHOLD,
  KNOWN_INDIAN_CITIES_INDEX
} from '../utils/geospatialDetector';

describe('Geospatial Detector Utility', () => {
  describe('calculateHaversineDistanceKm', () => {
    it('should return 0 for identical coordinates', () => {
      const dist = calculateHaversineDistanceKm(19.076, 72.8777, 19.076, 72.8777);
      expect(dist).toBe(0);
    });

    it('should calculate approximate distance between Mumbai and Pune accurately (~118 km)', () => {
      const dist = calculateHaversineDistanceKm(19.076, 72.8777, 18.5204, 73.8567);
      expect(dist).toBeGreaterThan(110);
      expect(dist).toBeLessThan(130);
    });
  });

  describe('detectCityAtCoordinates', () => {
    it('should return null when zoomLevel is below CITY_ZOOM_THRESHOLD', () => {
      const result = detectCityAtCoordinates(19.076, 72.8777, 5);
      expect(result).toBeNull();
    });

    it('should detect Mumbai when zoomLevel >= CITY_ZOOM_THRESHOLD and coordinates are at Mumbai center', () => {
      const result = detectCityAtCoordinates(19.076, 72.8777, 9);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Mumbai');
      expect(result?.state).toBe('Maharashtra');
    });

    it('should detect New Delhi when coordinates are within Delhi detection radius at zoom 10', () => {
      // Slightly offset coordinates within 10 km of New Delhi center
      const result = detectCityAtCoordinates(28.62, 77.21, 10);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('New Delhi');
    });

    it('should return null when coordinates are far outside any indexed city at zoom 10', () => {
      // Middle of Arabian Sea
      const result = detectCityAtCoordinates(14.0, 68.0, 10);
      expect(result).toBeNull();
    });
  });
});
