'use client';

import React, { useState, useEffect } from 'react';
import {
  DetectedPlace,
  getAdministrativeDetectionLevel
} from '../utils/geospatialDetector';
import { fetchLiveWeather, LiveWeatherData } from '../services/weatherService';
import { DistrictReticleInfo } from '../services/dynamicCityService';
import {
  MapPin,
  Compass,
  RotateCcw,
  Users,
  CloudSun,
  Loader2,
  Wind,
  Droplets,
  Layers,
  Sparkles,
  Crosshair
} from 'lucide-react';

interface CityDetectedPanelProps {
  detectedCity: DetectedPlace | null;
  activeDistrict?: DistrictReticleInfo | null;
  dynamicPlaceName?: string;
  dynamicState?: string;
  dynamicCoords?: [number, number] | null;
  isZoomedIn: boolean;
  zoomLevel: number;
  onCenterCity?: (lat: number, lng: number) => void;
  onResetView?: () => void;
}

export function CityDetectedPanel({
  detectedCity,
  activeDistrict,
  dynamicPlaceName,
  dynamicState,
  dynamicCoords,
  isZoomedIn,
  zoomLevel,
  onCenterCity,
  onResetView
}: CityDetectedPanelProps) {
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Reset weather whenever place changes so we don't automatically make API calls
  const placeIdKey =
    activeDistrict?.districtName ||
    (detectedCity ? detectedCity.id : dynamicPlaceName || '');

  useEffect(() => {
    setLiveWeather(null);
    setWeatherError(null);
    setLoadingWeather(false);
  }, [placeIdKey]);

  if (!isZoomedIn || (!detectedCity && !dynamicPlaceName && !activeDistrict)) {
    return null;
  }

  const name =
    activeDistrict?.districtName ||
    (detectedCity ? detectedCity.name : dynamicPlaceName || 'Detected Area');

  const state =
    activeDistrict?.stateName ||
    (detectedCity ? detectedCity.state : dynamicState || 'India');

  const locality = activeDistrict?.locality;

  const placeType = detectedCity ? detectedCity.placeType : 'District Reticle Area';
  const elevation = detectedCity ? `${detectedCity.elevationMeters}m ASL` : 'Live Center Target (+)';

  const populationEstimate = detectedCity
    ? detectedCity.populationEstimate
    : zoomLevel >= 11
    ? '~250,000 - 1.2 Million'
    : '~1.5 - 4.0 Million';

  const detectionLevel = getAdministrativeDetectionLevel(zoomLevel);

  const coords: [number, number] = activeDistrict
    ? activeDistrict.coordinates
    : detectedCity
    ? detectedCity.coordinates
    : dynamicCoords || [20.5937, 78.9629];

  const handleFetchWeather = async () => {
    setLoadingWeather(true);
    setWeatherError(null);
    const data = await fetchLiveWeather(coords[0], coords[1]);
    setLoadingWeather(false);
    if (data) {
      setLiveWeather(data);
    } else {
      setWeatherError('Could not reach weather API. Please try again.');
    }
  };

  return (
    <div
      data-testid="city-detected-panel"
      className="absolute top-32 left-4 z-[1000] w-80 max-w-[calc(100vw-32px)] transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-3"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-2xl shadow-2xl shadow-black/90 p-4 text-slate-100">
        {/* Glow Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />

        {/* Status indicator badge */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
            <Crosshair className="h-3 w-3 text-emerald-400 animate-spin-slow" />
            BASERA TARGET LAYER (+)
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
            {elevation}
          </span>
        </div>

        {/* Detection Administrative Level clarification */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300 mb-2">
          <Layers className="h-3.5 w-3.5" />
          <span>Level: {detectionLevel} ({placeType})</span>
        </div>

        {/* District / City Name */}
        <h2
          data-testid="detected-city-name"
          className="text-2xl font-black tracking-tight text-white flex items-center gap-2 truncate"
        >
          {name}
        </h2>

        {/* State / Locality under + */}
        <p
          data-testid="detected-city-state"
          className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 truncate"
        >
          <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <span>
            {state}
            {locality ? ` • ${locality}` : detectedCity?.district ? ` • ${detectedCity.district}` : ''}
          </span>
        </p>

        {/* Exact Reticle (+) Coordinates */}
        <div className="mt-2 text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5 flex items-center justify-between">
          <span>Center (+) Target:</span>
          <span className="text-emerald-400 font-bold">
            {coords[0].toFixed(4)}° N, {coords[1].toFixed(4)}° E
          </span>
        </div>

        {/* Estimated Population */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            Est. Population:
          </span>
          <strong className="text-emerald-300 font-bold">{populationEstimate}</strong>
        </div>

        {/* On-Demand Live Weather & Climate Section (Quota Preserving) */}
        <div className="mt-3 pt-2.5 border-t border-white/10">
          {!liveWeather && !loadingWeather && (
            <button
              onClick={handleFetchWeather}
              data-testid="fetch-weather-btn"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-500/30 hover:border-amber-400/50 text-white text-xs font-bold transition-all shadow-md"
            >
              <CloudSun className="h-4 w-4 text-amber-400" />
              <span>Fetch Live Weather & Climate</span>
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            </button>
          )}

          {loadingWeather && (
            <div className="flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-emerald-300 bg-white/5 rounded-xl border border-white/10 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              Calling Open-Meteo Weather API...
            </div>
          )}

          {weatherError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 mt-1 flex items-center justify-between">
              <span>{weatherError}</span>
              <button
                onClick={handleFetchWeather}
                className="text-[11px] font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {liveWeather && (
            <div
              data-testid="live-weather-card"
              className="bg-white/5 rounded-xl p-2.5 border border-amber-500/30 space-y-2 animate-in fade-in"
            >
              {/* Top row: Current Temp & Condition */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Live Open-Meteo</div>
                  <div className="text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                    <CloudSun className="h-4 w-4 text-amber-400" />
                    {liveWeather.conditionText}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white">
                    {liveWeather.currentTemp}°C
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Feels like {liveWeather.feelsLike}°
                  </div>
                </div>
              </div>

              {/* Middle row: Wind & Humidity */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/10 text-[11px] text-slate-300">
                <div className="flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5 text-teal-400" />
                  <span>Wind: {liveWeather.windSpeedKmH} km/h</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 text-sky-400" />
                  <span>Humidity: {liveWeather.humidity}%</span>
                </div>
              </div>

              {/* Bottom row: 7-Day High / Low Forecast */}
              {liveWeather.dailyForecast.length > 0 && (
                <div className="pt-1.5 border-t border-white/10">
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                    7-Day High / Low Forecast
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {liveWeather.dailyForecast.map((df, idx) => (
                      <div
                        key={idx}
                        className="bg-white/5 rounded px-1 py-1 text-center border border-white/5"
                      >
                        <div className="text-[9px] font-extrabold uppercase text-slate-400">
                          {df.day}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-amber-400 mt-0.5">
                          {df.maxTemp}°
                        </div>
                        <div className="text-[10px] font-mono text-teal-400">
                          {df.minTemp}°
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Updated at {liveWeather.fetchedAt}</span>
                <button
                  onClick={handleFetchWeather}
                  className="text-emerald-400 hover:underline"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Distance / Telemetry */}
        {detectedCity?.distanceKm !== undefined && !activeDistrict && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Distance to center:</span>
            <strong className="text-emerald-300 font-mono">
              {detectedCity.distanceKm} km away
            </strong>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {detectedCity && onCenterCity && !activeDistrict && (
            <button
              onClick={() => onCenterCity(detectedCity.coordinates[0], detectedCity.coordinates[1])}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
            >
              <Compass className="h-3.5 w-3.5" />
              Focus {name}
            </button>
          )}
          {onResetView && (
            <button
              onClick={onResetView}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-all border border-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset India View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
