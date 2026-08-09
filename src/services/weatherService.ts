export interface DailyForecast {
  day: string; // e.g. "Mon" or "Jul 10"
  maxTemp: number; // °C
  minTemp: number; // °C
}

export interface LiveWeatherData {
  currentTemp: number;
  feelsLike: number;
  humidity: number;
  windSpeedKmH: number;
  conditionText: string;
  dailyForecast: DailyForecast[];
  fetchedAt: string;
}

/**
 * Maps WMO Weather interpretation codes (WW) to human-readable conditions
 */
export function getWeatherConditionText(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain / Showers';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Heavy Showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Fair / Atmospheric';
}

/**
 * Formats date string (YYYY-MM-DD) into short day name (e.g., "Mon")
 */
function formatShortDay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return dateStr;
  }
}

/**
 * Fetches real-time weather and 7-day high/low climate forecast from Open-Meteo free API.
 * Requires NO API key.
 */
export async function fetchLiveWeather(lat: number, lng: number): Promise<LiveWeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
      4
    )}&longitude=${lng.toFixed(
      4
    )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = await res.json();

    const current = data.current || {};
    const daily = data.daily || {};

    const dailyForecast: DailyForecast[] = [];
    if (daily.time && Array.isArray(daily.time)) {
      for (let i = 0; i < Math.min(7, daily.time.length); i++) {
        dailyForecast.push({
          day: formatShortDay(daily.time[i]),
          maxTemp: Math.round(daily.temperature_2m_max[i]),
          minTemp: Math.round(daily.temperature_2m_min[i])
        });
      }
    }

    return {
      currentTemp: Math.round(current.temperature_2m ?? 25),
      feelsLike: Math.round(current.apparent_temperature ?? 25),
      humidity: Math.round(current.relative_humidity_2m ?? 50),
      windSpeedKmH: Math.round(current.wind_speed_10m ?? 10),
      conditionText: getWeatherConditionText(current.weather_code ?? 0),
      dailyForecast,
      fetchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    console.error('Failed to fetch live weather from Open-Meteo:', err);
    return null;
  }
}
