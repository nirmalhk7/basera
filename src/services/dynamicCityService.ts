import { DynamicCityInfo } from '../types/city';

export function getWeatherDescriptionFromCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1 || code === 2) return 'Mostly Sunny / Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Misty / Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle / Light Rain';
  if (code >= 61 && code <= 65) return 'Monsoon Rain Showers';
  if (code >= 80 && code <= 82) return 'Heavy Rain Squall';
  if (code >= 95 && code <= 99) return 'Thunderstorm & Lightning';
  return 'Pleasant Weather';
}

export interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  name: string;
  addresstype?: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    state_district?: string;
    county?: string;
    district?: string;
  };
}

/**
 * Dynamically searches strictly for administrative districts in India using OpenStreetMap Nominatim API
 */
export async function searchDynamicPlaces(query: string): Promise<NominatimSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const cleanQuery = query.toLowerCase().includes('district')
      ? query.trim()
      : `${query.trim()} district`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      cleanQuery + ', India'
    )}&countrycodes=in&format=jsonv2&limit=15&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BaseraIndiaMap/1.0'
      }
    });
    if (!res.ok) return [];
    const rawData: NominatimSearchResult[] = await res.json();

    // Strictly filter for administrative districts
    const districtResults = rawData.filter(item => {
      const addrType = (item.addresstype || '').toLowerCase();
      const disp = (item.display_name || '').toLowerCase();
      const addr = item.address || {};
      const isDistrictType =
        addrType === 'district' ||
        addrType === 'state_district' ||
        addrType === 'county' ||
        disp.includes('district');
      return isDistrictType;
    });

    // Deduplicate and ensure clean district naming
    const seenNames = new Set<string>();
    const cleanDistricts: NominatimSearchResult[] = [];

    for (const item of districtResults) {
      const addr = item.address || {};
      const baseName =
        addr.state_district ||
        addr.district ||
        addr.county ||
        item.name ||
        item.display_name.split(',')[0];
      const normalizedName = baseName.toLowerCase().includes('district')
        ? baseName
        : `${baseName} District`;

      const key = normalizedName.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        const stateName = addr.state || 'India';
        cleanDistricts.push({
          ...item,
          name: normalizedName,
          display_name: `${normalizedName}, ${stateName}`
        });
      }
    }

    return cleanDistricts.slice(0, 8);
  } catch (err) {
    console.error('Nominatim strict district search error:', err);
    return [];
  }
}

/**
 * Dynamically fetches rich city/place information for ANY latitude & longitude in India
 */
export async function fetchDynamicCityInfo(lat: number, lng: number): Promise<DynamicCityInfo> {
  // 1. Fetch Reverse Geocoding from OpenStreetMap Nominatim
  let name = 'Unknown Terrain Location';
  let state = 'India';
  let district: string | undefined = undefined;
  let placeType = 'Terrain Zone';
  let population: number | undefined = undefined;

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      5
    )}&lon=${lng.toFixed(5)}&zoom=10&addressdetails=1&extratags=1`;
    const nomRes = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'IndiaTerrainExplorerApp/1.0'
      }
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const addr = nomData.address || {};
      name =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        nomData.name ||
        'Indian City Area';
      state = addr.state || 'India';
      district = addr.state_district || addr.county;
      placeType = addr.city ? 'City' : addr.town ? 'Town' : addr.village ? 'Village' : 'Urban Region';

      if (nomData.extratags && nomData.extratags.population) {
        const parsedPop = parseInt(nomData.extratags.population, 10);
        if (!isNaN(parsedPop) && parsedPop > 0) {
          population = parsedPop;
        }
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
  }

  // 2. Fetch Elevation from Open-Meteo Elevation API
  let elevationMeters = 0;
  try {
    const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}`;
    const elevRes = await fetch(elevUrl);
    if (elevRes.ok) {
      const elevData = await elevRes.json();
      if (elevData.elevation && elevData.elevation.length > 0) {
        elevationMeters = Math.round(elevData.elevation[0]);
      }
    }
  } catch (err) {
    console.warn('Elevation API error:', err);
  }

  // 3. Fetch Live Weather & Climate from Open-Meteo Forecast API
  let weather: DynamicCityInfo['weather'] = {
    temperatureCelsius: 26.0,
    apparentTemperature: 28.0,
    relativeHumidity: 65,
    windSpeedKmh: 10.0,
    precipitationMm: 0,
    weatherCode: 1,
    weatherDescription: 'Partly Cloudy',
    dailyMaxTemp: 31.0,
    dailyMinTemp: 21.0,
    isDay: true,
    fetchedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
      4
    )}&longitude=${lng.toFixed(
      4
    )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata`;
    const weatherRes = await fetch(weatherUrl);
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const curr = weatherData.current || {};
      const daily = weatherData.daily || {};
      weather = {
        temperatureCelsius: Math.round((curr.temperature_2m ?? 26) * 10) / 10,
        apparentTemperature: Math.round((curr.apparent_temperature ?? 28) * 10) / 10,
        relativeHumidity: Math.round(curr.relative_humidity_2m ?? 65),
        windSpeedKmh: Math.round((curr.wind_speed_10m ?? 10) * 10) / 10,
        precipitationMm: curr.precipitation ?? 0,
        weatherCode: curr.weather_code ?? 1,
        weatherDescription: getWeatherDescriptionFromCode(curr.weather_code ?? 1),
        dailyMaxTemp: daily.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : undefined,
        dailyMinTemp: daily.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : undefined,
        isDay: curr.is_day === 1,
        fetchedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
    }
  } catch (err) {
    console.warn('Weather API error:', err);
  }

  // 4. Fetch Dynamic Wikipedia Summary & Thumbnail for the City/Place
  let wikiSummary: DynamicCityInfo['wikiSummary'] = undefined;
  try {
    if (name && name !== 'Unknown Terrain Location') {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        if (wikiData.extract && wikiData.type !== 'disambiguation') {
          wikiSummary = {
            title: wikiData.title || name,
            extract: wikiData.extract,
            url: wikiData.content_urls?.desktop?.page,
            thumbnailUrl: wikiData.thumbnail?.source
          };
        }
      }
    }
  } catch (err) {
    console.warn('Wikipedia API error:', err);
  }

  return {
    name,
    state,
    district,
    country: 'India',
    coordinates: [lat, lng],
    elevationMeters,
    population,
    placeType,
    wikiSummary,
    weather
  };
}

export interface DistrictReticleInfo {
  districtName: string;
  stateName: string;
  locality?: string;
  coordinates: [number, number];
}

/**
 * Fast reverse geocode for the center reticle (+) to identify exact District under crosshair
 */
export async function fetchDistrictAtCoordinates(lat: number, lng: number): Promise<DistrictReticleInfo | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      5
    )}&lon=${lng.toFixed(5)}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BaseraIndiaMap/1.0'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const districtName =
      addr.state_district ||
      addr.county ||
      addr.district ||
      addr.city ||
      addr.town ||
      'Indian District';
    const stateName = addr.state || 'India';
    const locality = addr.suburb || addr.neighbourhood || addr.city_district || addr.town;

    return {
      districtName,
      stateName,
      locality,
      coordinates: [lat, lng]
    };
  } catch (err) {
    console.warn('District reticle fetch error:', err);
    return null;
  }
}
