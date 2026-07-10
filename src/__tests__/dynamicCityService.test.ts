import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchDynamicPlaces } from '../services/dynamicCityService';

describe('searchDynamicPlaces - Strict District Search', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should strictly filter and format search results to administrative districts in India', async () => {
    const mockNominatimResponse = [
      {
        display_name: 'Pune District, Maharashtra, India',
        name: 'Pune District',
        lat: '18.5204',
        lon: '73.8567',
        addresstype: 'district',
        address: {
          state_district: 'Pune District',
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
        display_name: 'Thane, Maharashtra, India',
        name: 'Thane',
        lat: '19.1998',
        lon: '72.9781',
        addresstype: 'state_district',
        address: {
          state_district: 'Thane District',
          state: 'Maharashtra'
        }
      }
    ];

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockNominatimResponse
    });

    const results = await searchDynamicPlaces('Pune');

    // Railway station should be filtered out; Pune District and Thane District should remain and be cleanly formatted
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Pune District');
    expect(results[0].display_name).toBe('Pune District, Maharashtra');
    expect(results[1].name).toBe('Thane District');
    expect(results[1].display_name).toBe('Thane District, Maharashtra');
  });
});
