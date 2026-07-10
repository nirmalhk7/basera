'use client';

import React, { useState } from 'react';
import { DynamicCityInfo } from '../types/city';
import {
  Users,
  MapPin,
  Mountain,
  Maximize2,
  CloudSun,
  Compass,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ThermometerSun,
  ShieldCheck,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface CityInfoHUDProps {
  cityInfo: DynamicCityInfo | null;
  isLoading: boolean;
  zoomLevel: number;
  centerCoords: [number, number];
  onFlyToCoords: (lat: number, lng: number) => void;
  onResetIndiaView: () => void;
}

export function CityInfoHUD({
  cityInfo,
  isLoading,
  zoomLevel,
  centerCoords,
  onFlyToCoords,
  onResetIndiaView
}: CityInfoHUDProps) {
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'weather' | 'wiki'>('overview');

  const formatPopulation = (num?: number) => {
    if (!num) return 'Live Area Census';
    if (num >= 10000000) {
      return `${(num / 10000000).toFixed(2)} Crore`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    return num.toLocaleString('en-IN');
  };

  const isCityLevelZoom = zoomLevel >= 8;

  return (
    <div className="absolute top-4 left-4 z-[1000] w-[390px] max-w-[calc(100vw-32px)] transition-all duration-300 ease-out">
      {/* Glassmorphism Main HUD Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/88 backdrop-blur-2xl shadow-2xl shadow-black/70 text-slate-100">
        {/* Glow Accent Header Banner */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />

        {/* Header Bar */}
        <div className="p-4 pb-3 flex items-start justify-between gap-3 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {isCityLevelZoom ? 'DYNAMIC CITY TERRAIN HUD' : 'INDIA REGIONAL TELEMETRY'}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-0.5 flex items-center gap-2 truncate">
              {isLoading ? (
                <span className="flex items-center gap-2 text-slate-300 text-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  Identifying City...
                </span>
              ) : (
                cityInfo?.name || 'Exploring India'
              )}
            </h1>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              {cityInfo ? `${cityInfo.state}${cityInfo.district ? ` • ${cityInfo.district}` : ''}` : 'Zoom or pan map'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {cityInfo && (
              <button
                onClick={() => onFlyToCoords(cityInfo.coordinates[0], cityInfo.coordinates[1])}
                title="Center on location"
                className="p-2 rounded-xl bg-white/10 hover:bg-emerald-500/30 text-slate-200 hover:text-white transition-all border border-white/10"
              >
                <Compass className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              title={minimized ? 'Expand HUD' : 'Minimize HUD'}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-all border border-white/10"
            >
              {minimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Minimized quick bar */}
        {minimized ? (
          <div className="px-4 py-2.5 flex items-center justify-between text-xs bg-slate-900/60 text-slate-300">
            <span>Elev: <strong className="text-emerald-300">{cityInfo?.elevationMeters ?? 0}m ASL</strong></span>
            <span>Temp: <strong className="text-sky-300">{cityInfo?.weather.temperatureCelsius ?? '--'}°C</strong></span>
            <span>Zoom: <strong className="text-amber-300">{zoomLevel.toFixed(1)}x</strong></span>
          </div>
        ) : (
          <>
            {/* Quick Metrics 4-Grid */}
            <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-900/40 border-b border-white/10">
              {/* Population / Place Type */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Population / Type</div>
                  <div className="text-sm font-bold text-white">
                    {formatPopulation(cityInfo?.population)}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">{cityInfo?.placeType || 'City Zone'}</div>
                </div>
              </div>

              {/* Elevation */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
                  <Mountain className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Terrain Elevation</div>
                  <div className="text-sm font-bold text-white">
                    {cityInfo ? `${cityInfo.elevationMeters} m ASL` : '--'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {cityInfo ? `${Math.round(cityInfo.elevationMeters * 3.28084)} ft altitude` : 'Live SRTM API'}
                  </div>
                </div>
              </div>

              {/* Coordinates */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400">
                  <Maximize2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Center Coords</div>
                  <div className="text-xs font-mono font-bold text-white">
                    {centerCoords[0].toFixed(3)}°N, {centerCoords[1].toFixed(3)}°E
                  </div>
                  <div className="text-[10px] text-slate-400">Realtime OSM Reverse Geo</div>
                </div>
              </div>

              {/* Live Weather Quick Badge */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
                  <CloudSun className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Live Weather</div>
                  <div className="text-sm font-bold text-white">
                    {isLoading || !cityInfo ? '...' : `${cityInfo.weather.temperatureCelsius}°C`}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                    {cityInfo ? cityInfo.weather.weatherDescription : 'Open-Meteo API'}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-slate-900/70 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-2 text-center transition-all border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('weather')}
                className={`flex-1 py-2 text-center transition-all border-b-2 ${
                  activeTab === 'weather'
                    ? 'border-sky-400 text-sky-400 bg-sky-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Weather
              </button>
              <button
                onClick={() => setActiveTab('wiki')}
                className={`flex-1 py-2 text-center transition-all border-b-2 ${
                  activeTab === 'wiki'
                    ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Wikipedia Info
              </button>
            </div>

            {/* Tab Body Content */}
            <div className="p-4 max-h-[250px] overflow-y-auto custom-scrollbar text-xs leading-relaxed space-y-3">
              {activeTab === 'overview' && (
                <div className="space-y-3">
                  {!isCityLevelZoom && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-center justify-between">
                      <span>💡 <strong>Scroll & Zoom In</strong> to any city/town in India for dynamic detail!</span>
                    </div>
                  )}

                  {cityInfo?.wikiSummary?.thumbnailUrl && (
                    <div className="relative h-28 w-full rounded-xl overflow-hidden border border-white/10">
                      <img
                        src={cityInfo.wikiSummary.thumbnailUrl}
                        alt={cityInfo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 text-[11px] font-bold text-white drop-shadow">
                        {cityInfo.name} Photo
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                      Dynamic Geographic Summary
                    </div>
                    <p className="text-slate-300">
                      {cityInfo?.wikiSummary?.extract
                        ? cityInfo.wikiSummary.extract
                        : `${cityInfo?.name || 'This location'} is situated in ${
                            cityInfo?.state || 'India'
                          } at a terrain elevation of ${cityInfo?.elevationMeters ?? 0} meters above sea level.`}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'weather' && (
                <div className="space-y-3">
                  {/* Real-time telemetry card */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-sky-950/60 to-slate-900 border border-sky-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <ThermometerSun className="h-3.5 w-3.5" />
                        Live Open-Meteo Atmospheric Data
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {cityInfo ? `Updated ${cityInfo.weather.fetchedAt}` : 'Loading...'}
                      </span>
                    </div>

                    {cityInfo ? (
                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="bg-white/5 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-400">Temp</div>
                          <div className="text-base font-extrabold text-white">
                            {cityInfo.weather.temperatureCelsius}°C
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Feels {cityInfo.weather.apparentTemperature}°
                          </div>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-400">Humidity</div>
                          <div className="text-base font-extrabold text-sky-300">
                            {cityInfo.weather.relativeHumidity}%
                          </div>
                          <div className="text-[9px] text-slate-400">Relative</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-400">Wind Speed</div>
                          <div className="text-base font-extrabold text-teal-300">
                            {cityInfo.weather.windSpeedKmh}
                          </div>
                          <div className="text-[9px] text-slate-400">km/h</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-slate-400">Fetching live atmospheric data...</div>
                    )}
                  </div>

                  {cityInfo && (
                    <div className="space-y-1.5 pt-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300">Condition:</span>
                        <span className="text-sky-300 font-bold">{cityInfo.weather.weatherDescription}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300">Precipitation:</span>
                        <span className="text-emerald-400 font-bold">{cityInfo.weather.precipitationMm} mm</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'wiki' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <BookOpen className="h-4 w-4" />
                      <span>Wikipedia Dynamic Extract</span>
                    </div>
                    {cityInfo?.wikiSummary?.url && (
                      <a
                        href={cityInfo.wikiSummary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                      >
                        Read article <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {cityInfo?.wikiSummary?.extract ||
                      `Wikipedia article summary not found for this exact coordinate. Scroll to zoom directly over a city center to fetch full encyclopedic articles via MediaWiki API.`}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            <div className="px-4 py-2.5 bg-slate-900/90 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Zoom Level: <strong className="text-white">{zoomLevel.toFixed(1)}</strong></span>
              </div>

              <button
                onClick={onResetIndiaView}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 text-xs font-medium transition-all"
              >
                <RotateCcw className="h-3 w-3" />
                India Overview
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
