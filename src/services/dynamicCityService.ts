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
    suburb?: string;
    municipality?: string;
    city_district?: string;
    state?: string;
    state_district?: string;
    county?: string;
    district?: string;
  };
}

/**
 * Dynamically searches for local administrative places (City/Town/Village) in India using OpenStreetMap Nominatim API
 */
export async function searchDynamicPlaces(query: string): Promise<NominatimSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const cleanQuery = query.trim();
    const url = `/api/nominatim?path=search&q=${encodeURIComponent(
      cleanQuery + ', India'
    )}&countrycodes=in&format=jsonv2&limit=15&addressdetails=1`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const rawData: NominatimSearchResult[] = await res.json();

    // Filter for administrative places or towns/cities/villages
    const localResults = rawData.filter(item => {
      const addrType = (item.addresstype || '').toLowerCase();
      return (
        addrType === 'city' ||
        addrType === 'town' ||
        addrType === 'village' ||
        addrType === 'municipality' ||
        addrType === 'administrative' ||
        addrType === 'suburb' ||
        addrType === 'county' ||
        addrType === 'district'
      );
    });

    // Deduplicate and ensure clean naming
    const seenNames = new Set<string>();
    const cleanPlaces: NominatimSearchResult[] = [];

    for (const item of localResults) {
      const addr = item.address || {};
      const baseName =
        addr.village ||
        addr.town ||
        addr.city ||
        addr.suburb ||
        addr.municipality ||
        item.name ||
        item.display_name.split(',')[0];

      const key = baseName.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        const stateName = addr.state || 'India';
        cleanPlaces.push({
          ...item,
          name: baseName,
          display_name: `${baseName}, ${stateName}`
        });
      }
    }

    return cleanPlaces.slice(0, 8);
  } catch (err) {
    console.error('Nominatim strict district search error:', err);
    return [];
  }
}

/**
 * Dynamically fetches rich city/place information for ANY latitude & longitude in India
 */
export async function fetchDynamicCityInfo(lat: number, lng: number): Promise<DynamicCityInfo> {
  // 0. Fetch planning jurisdiction details from our local GeoJSON API
  let website: string | undefined = undefined;
  let state_planning_directorate: string | undefined = undefined;
  let town_planner_designation: string | undefined = undefined;
  let state_planning_website: string | undefined = undefined;
  let state_planning_email: string | undefined = undefined;
  let planning_authority: string | undefined = undefined;
  let town_planner_jurisdiction: string | undefined = undefined;
  let geoJsonBoundary: any = undefined;
  let planning_documents: { title: string; url: string }[] | undefined = undefined;
  let state_planning_portal: string | undefined = undefined;
  let search_documents_url: string | undefined = undefined;
  let search_documents_ddg_url: string | undefined = undefined;

  let name = 'Unknown Terrain Location';
  let state = 'India';
  let district: string | undefined = undefined;
  let placeType = 'Terrain Zone';
  let rawLocalityName = '';
  let population: number | undefined = undefined;

  try {
    const jurUrl = `/api/jurisdiction?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`;
    const jurRes = await fetch(jurUrl);
    if (jurRes.ok) {
      const jurData = await jurRes.json();
      if (jurData.found && jurData.properties) {
        const props = jurData.properties;
        website = props.website;
        state_planning_directorate = props.state_planning_directorate;
        town_planner_designation = props.town_planner_designation;
        state_planning_website = props.state_planning_website;
        state_planning_email = props.state_planning_email;
        planning_authority = props.planning_authority;
        town_planner_jurisdiction = props.town_planner_jurisdiction;
        geoJsonBoundary = jurData.geometry;
        planning_documents = props.planning_documents;
        state_planning_portal = props.state_planning_portal;
        search_documents_url = props.search_documents_url;
        search_documents_ddg_url = props.search_documents_ddg_url;
        
        if (props.name_en) {
          name = props.name_en;
          rawLocalityName = props.name_en;
        }
        if (props.place_type) {
          placeType = props.place_type.charAt(0).toUpperCase() + props.place_type.slice(1);
        }
      }
    }
  } catch (err) {
    console.warn('Jurisdiction lookup error:', err);
  }

  // 1. Fetch Reverse Geocoding from OpenStreetMap Nominatim at Local Scale (zoom=14)
  try {
    const nominatimUrl = `/api/nominatim?path=reverse&format=jsonv2&lat=${lat.toFixed(
      5
    )}&lon=${lng.toFixed(5)}&zoom=14&addressdetails=1&extratags=1`;
    const nomRes = await fetch(nominatimUrl);
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const addr = nomData.address || {};

      // Determine the most localized governance entity for Town Planner detection
      if (addr.village) {
        rawLocalityName = addr.village;
        name = `${addr.village} Gram Panchayat`;
        placeType = 'Gram Panchayat';
      } else if (addr.town) {
        rawLocalityName = addr.town;
        name = `${addr.town} Municipal Council`;
        placeType = 'Municipal Council';
      } else if (addr.city) {
        rawLocalityName = addr.city;
        name = `${addr.city} Municipal Corporation`;
        placeType = 'Municipal Corporation';
      } else if (addr.suburb || addr.city_district) {
        rawLocalityName = addr.suburb || addr.city_district;
        name = `${rawLocalityName} Zonal Planner`;
        placeType = 'Ward/Zonal Planner';
      } else if (addr.county) {
        rawLocalityName = addr.county;
        name = `${addr.county} Tehsil Planner`;
        placeType = 'Tehsil Planner';
      } else if (addr.state_district) {
        rawLocalityName = addr.state_district;
        name = `${addr.state_district} District Planner`;
        placeType = 'District Planner';
      } else {
        rawLocalityName = nomData.name || 'Local Authority';
        name = nomData.name || 'Local Authority';
        placeType = 'Local Authority';
      }

      state = addr.state || 'India';
      district = addr.state_district || addr.county;

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
    rawLocalityName,
    state,
    district,
    country: 'India',
    coordinates: [lat, lng],
    elevationMeters,
    population,
    placeType,
    wikiSummary,
    weather,
    website,
    state_planning_directorate,
    town_planner_designation,
    state_planning_website,
    state_planning_email,
    planning_authority,
    town_planner_jurisdiction,
    geoJsonBoundary,
    planning_documents,
    state_planning_portal,
    search_documents_url,
    search_documents_ddg_url
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
