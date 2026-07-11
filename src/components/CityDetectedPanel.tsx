'use client';

import React from 'react';
import {
  DetectedPlace,
  getAdministrativeDetectionLevel,
  estimateMonthlyClimate,
  MonthlyClimate
} from '../utils/geospatialDetector';
import {
  MapPin,
  Compass,
  RotateCcw,
  Users,
  ThermometerSun,
  Layers
} from 'lucide-react';

interface CityDetectedPanelProps {
  detectedCity: DetectedPlace | null;
  dynamicPlaceName?: string;
  dynamicState?: string;
  dynamicPlaceType?: string;
  isZoomedIn: boolean;
  zoomLevel: number;
  onCenterCity?: (lat: number, lng: number) => void;
  onResetView?: () => void;
  website?: string;
  statePlanningDirectorate?: string;
  townPlannerDesignation?: string;
  statePlanningWebsite?: string;
  statePlanningEmail?: string;
  planningAuthority?: string;
}

export function CityDetectedPanel({
  detectedCity,
  dynamicPlaceName,
  dynamicState,
  dynamicPlaceType,
  isZoomedIn,
  zoomLevel,
  onCenterCity,
  onResetView,
  website,
  statePlanningDirectorate,
  townPlannerDesignation,
  statePlanningWebsite,
  statePlanningEmail,
  planningAuthority
}: CityDetectedPanelProps) {
  if (!isZoomedIn || (!detectedCity && !dynamicPlaceName)) {
    return null;
  }

  const name = detectedCity ? detectedCity.name : dynamicPlaceName || 'Detected Area';

  const state = detectedCity ? detectedCity.state : dynamicState || 'India';

  const locality = undefined;

  const placeType = detectedCity
    ? detectedCity.placeType
    : dynamicPlaceType || 'Local Authority';

  const populationEstimate = detectedCity
    ? detectedCity.populationEstimate
    : zoomLevel >= 11
    ? '~250,000 - 1.2 Million'
    : '~1.5 - 4.0 Million';

  const monthlyClimate: MonthlyClimate[] = detectedCity
    ? detectedCity.monthlyClimate
    : estimateMonthlyClimate(21.0, 150);

  const detectionLevel = getAdministrativeDetectionLevel(zoomLevel);

  const targetCoords: [number, number] = detectedCity
    ? detectedCity.coordinates
    : [20.5937, 78.9629];

  return (
    <div
      data-testid="city-detected-panel"
      className="absolute top-32 left-4 z-[1000] w-80 max-w-[calc(100vw-32px)] transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-3"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-2xl shadow-2xl shadow-black/90 p-4 text-slate-100">
        {/* Glow Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />

        {/* Detection Level indication */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300 mb-2 mt-1">
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

        {/* State / Locality */}
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

        {/* Estimated Population */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            Est. Population:
          </span>
          <strong className="text-emerald-300 font-bold">{populationEstimate}</strong>
        </div>

        {/* Town Planner & Jurisdiction Info */}
        {(planningAuthority || website || townPlannerDesignation || statePlanningDirectorate) && (
          <div className="mt-2.5 pt-2 border-t border-white/10 text-xs">
            <span className="text-amber-300 font-semibold flex items-center gap-1.5 mb-1.5">
              <Compass className="h-3.5 w-3.5 text-amber-300" />
              Town Planner Jurisdiction
            </span>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 space-y-1.5 text-[11px]">
              {planningAuthority && (
                <div>
                  <span className="text-slate-400">Authority: </span>
                  <strong className="text-white font-medium">{planningAuthority}</strong>
                </div>
              )}
              {website && (
                <div>
                  <span className="text-slate-400">Website: </span>
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-300 hover:underline font-medium break-all"
                  >
                    {website.replace("https://", "").replace("http://", "")}
                  </a>
                </div>
              )}
              {(townPlannerDesignation || statePlanningDirectorate) && (
                <div className="pt-1.5 mt-1.5 border-t border-white/5">
                  <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">State Planner Office</div>
                  {townPlannerDesignation && <div className="text-white font-semibold">{townPlannerDesignation}</div>}
                  {statePlanningDirectorate && <div className="text-slate-300 text-[10px]">{statePlanningDirectorate}</div>}
                  {statePlanningEmail && (
                    <div className="text-[10px] mt-0.5">
                      <span className="text-slate-400">Email: </span>
                      <a href={`mailto:${statePlanningEmail}`} className="text-emerald-300 hover:underline">
                        {statePlanningEmail}
                      </a>
                    </div>
                  )}
                  {statePlanningWebsite && (
                    <div className="text-[10px]">
                      <span className="text-slate-400">Web: </span>
                      <a
                        href={statePlanningWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-300 hover:underline"
                      >
                        {statePlanningWebsite.replace("https://", "").replace("http://", "")}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Climatology Grid (Jan - Dec Highs & Lows) */}
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
          {onCenterCity && (
            <button
              onClick={() => onCenterCity(targetCoords[0], targetCoords[1])}
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
