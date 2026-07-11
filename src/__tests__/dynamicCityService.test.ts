import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchDynamicPlaces } from '../services/dynamicCityService';

describe('searchDynamicPlaces - Local Town Planner Search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should filter and format search results to local governance units (city, town, village, suburb) in India', async () => {
    const mockNominatimResponse = [
      {
        display_name: 'Pune, Maharashtra, India',
        name: 'Pune',
        lat: '18.5204',
        lon: '73.8567',
        addresstype: 'city',
        address: {
          city: 'Pune',
          state: 'Maharashtra'
        }
      },
      {
        display_name: 'Pune Railway Station, Maharashtra, India',
        name: 'Pune Railway Station',
        lat: '18.5284',
        lon: '73.8738',
        addresstype: 'railway'
      },
      {
        display_name: 'Khadki, Pune, Maharashtra, India',
        name: 'Khadki',
        lat: '18.5682',
        lon: '73.8508',
        addresstype: 'town',
        address: {
          town: 'Khadki',
          state: 'Maharashtra'
        }
      }
    ];

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse
    });

    const results = await searchDynamicPlaces('Pune');

    // Railway station should be filtered out; City and Town should remain and be cleanly formatted
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Pune');
    expect(results[0].display_name).toBe('Pune, Maharashtra');
    expect(results[1].name).toBe('Khadki');
    expect(results[1].display_name).toBe('Khadki, Maharashtra');
  });
});
