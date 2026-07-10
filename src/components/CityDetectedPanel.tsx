'use client';

import React from 'react';
import {
  DetectedPlace,
  getAdministrativeDetectionLevel,
  estimateMonthlyClimate,
  MonthlyClimate
} from '../utils/geospatialDetector';
import { MapPin, Compass, RotateCcw, Users, ThermometerSun, Layers } from 'lucide-react';

interface CityDetectedPanelProps {
  detectedCity: DetectedPlace | null;
  dynamicPlaceName?: string;
  dynamicState?: string;
  isZoomedIn: boolean;
  zoomLevel: number;
  onCenterCity?: (lat: number, lng: number) => void;
  onResetView?: () => void;
}

export function CityDetectedPanel({
  detectedCity,
  dynamicPlaceName,
  dynamicState,
  isZoomedIn,
  zoomLevel,
  onCenterCity,
  onResetView
}: CityDetectedPanelProps) {
  if (!isZoomedIn || (!detectedCity && !dynamicPlaceName)) {
    return null;
  }

  const name = detectedCity ? detectedCity.name : dynamicPlaceName || 'Detected Town';
  const state = detectedCity ? detectedCity.state : dynamicState || 'India';
  const placeType = detectedCity ? detectedCity.placeType : 'Town / Municipal Area';
  const elevation = detectedCity ? `${detectedCity.elevationMeters}m ASL` : 'Live Terrain Zone';

  const populationEstimate = detectedCity
    ? detectedCity.populationEstimate
    : zoomLevel >= 11
    ? '~120,000 - 350,000'
    : '~500,000+';

  const monthlyClimate: MonthlyClimate[] = detectedCity
    ? detectedCity.monthlyClimate
    : estimateMonthlyClimate(21.0, 100);

  const detectionLevel = getAdministrativeDetectionLevel(zoomLevel);

  return (
    <div
      data-testid="city-detected-panel"
      className="absolute top-32 left-4 z-[1000] w-80 max-w-[calc(100vw-32px)] transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-3"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl shadow-black/90 p-4 text-slate-100">
        {/* Glow Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />

        {/* Status indicator badge */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            BASERA GEOSPATIAL LAYER
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

        {/* City / Town Name */}
        <h2
          data-testid="detected-city-name"
          className="text-2xl font-black tracking-tight text-white flex items-center gap-2 truncate"
        >
          {name}
        </h2>

        {/* State / District */}
        <p
          data-testid="detected-city-state"
          className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 truncate"
        >
          <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <span>
            {state}
            {detectedCity?.district ? ` • ${detectedCity.district}` : ''}
          </span>
        </p>

        {/* Estimated Population */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            Est. Population:
          </span>
          <strong className="text-emerald-300 font-bold">{populationEstimate}</strong>
        </div>

        {/* Monthly Climate Profile Grid (Jan - Dec Highs & Lows) */}
        <div className="mt-2.5 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 font-semibold text-amber-300">
              <ThermometerSun className="h-3.5 w-3.5" />
              Monthly Climate (High / Low °C)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {monthlyClimate.map((mc, idx) => (
              <div
                key={idx}
                className="bg-white/5 rounded-lg px-1.5 py-1 text-center border border-white/5 hover:border-emerald-500/40 transition-all"
              >
                <div className="text-[10px] font-extrabold uppercase text-slate-400">
                  {mc.month}
                </div>
                <div className="text-[11px] font-mono text-white">
                  <span className="text-amber-400">{mc.high}°</span>
                  <span className="text-slate-500 mx-0.5">/</span>
                  <span className="text-teal-400">{mc.low}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distance / Telemetry */}
        {detectedCity?.distanceKm !== undefined && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Distance to center:</span>
            <strong className="text-emerald-300 font-mono">
              {detectedCity.distanceKm} km away
            </strong>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {detectedCity && onCenterCity && (
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
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-all border border-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              India
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
