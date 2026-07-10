import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  detectCityAtCoordinates,
  isCoordinateWithinIndiaBounds,
  INDIA_BOUNDS_COORDS,
  CITY_ZOOM_THRESHOLD
} from '../utils/geospatialDetector';

describe('Geospatial Detector Utility', () => {
  describe('isCoordinateWithinIndiaBounds', () => {
    it('should return true for major Indian cities inside bounds', () => {
      expect(isCoordinateWithinIndiaBounds(19.076, 72.8777)).toBe(true); // Mumbai
      expect(isCoordinateWithinIndiaBounds(28.6139, 77.209)).toBe(true); // New Delhi
      expect(isCoordinateWithinIndiaBounds(34.1526, 77.5771)).toBe(true); // Leh
      expect(isCoordinateWithinIndiaBounds(8.0883, 77.5385)).toBe(true); // Kanyakumari
      expect(isCoordinateWithinIndiaBounds(22.0, 60.0)).toBe(true); // Western Arabian Sea / Gujarat left scroll margin
    });

    it('should return false for coordinates outside India bounding box', () => {
      expect(isCoordinateWithinIndiaBounds(51.5072, -0.1276)).toBe(false); // London
      expect(isCoordinateWithinIndiaBounds(40.7128, -74.006)).toBe(false); // New York
      expect(isCoordinateWithinIndiaBounds(35.6762, 139.6503)).toBe(false); // Tokyo
      expect(isCoordinateWithinIndiaBounds(-33.8688, 151.2093)).toBe(false); // Sydney
    });
  });

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
      const result = detectCityAtCoordinates(28.62, 77.21, 10);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('New Delhi');
    });

    it('should return null when coordinates are far outside any indexed city at zoom 10', () => {
      const result = detectCityAtCoordinates(14.0, 68.0, 10);
      expect(result).toBeNull();
    });
  });
});
