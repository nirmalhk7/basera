import { describe, it, expect } from 'vitest';
import { getWeatherConditionText } from '../services/weatherService';

describe('Weather Service Utility', () => {
  it('should map WMO weather codes to readable condition descriptions', () => {
    expect(getWeatherConditionText(0)).toBe('Clear Sky');
    expect(getWeatherConditionText(2)).toBe('Partly Cloudy');
    expect(getWeatherConditionText(61)).toBe('Rain / Showers');
    expect(getWeatherConditionText(95)).toBe('Thunderstorm');
  });
});
