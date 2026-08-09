'use client';

import React, { useState, useEffect } from 'react';
import { TerrainLayerId } from '../types/city';
import { searchDynamicPlaces, NominatimSearchResult } from '../services/dynamicCityService';
import {
  Search,
  Layers,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface MapControlsProps {
  activeLayer: TerrainLayerId;
  onLayerChange: (layer: TerrainLayerId) => void;
  onFlyToCoords: (lat: number, lng: number, name: string) => void;
}

export function MapControls({
  activeLayer,
  onLayerChange,
  onFlyToCoords
}: MapControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<NominatimSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchDynamicPlaces(searchQuery);
      setResults(res);
      setSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const quickCities = [
    { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
    { name: 'New Delhi', lat: 28.6139, lng: 77.209 },
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Srinagar', lat: 34.0837, lng: 74.7973 },
    { name: 'Leh', lat: 34.1526, lng: 77.5771 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Varanasi', lat: 25.3176, lng: 82.9739 },
    { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
    { name: 'Jaipur', lat: 26.9124, lng: 75.7873 }
  ];

  const layers: { id: TerrainLayerId; label: string; desc: string }[] = [
    { id: 'esri-topo', label: 'Esri Topo Relief', desc: 'Topographic Hillshade' },
    { id: 'opentopomap', label: 'OpenTopoMap', desc: 'Elevation Contours' },
    { id: 'satellite', label: 'Satellite Terrain', desc: 'True Mountain Imagery' },
    { id: 'dark-relief', label: 'Dark Night Relief', desc: 'Sleek Cyber Map' }
  ];

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-3 max-w-[420px] w-full pointer-events-none">
      {/* Live OSM Nominatim Search Bar */}
      <div className="w-full pointer-events-auto">
        <div className="relative">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/88 backdrop-blur-2xl border border-white/15 shadow-2xl text-slate-100">
            {searching ? (
              <Loader2 className="h-4 w-4 text-emerald-400 shrink-0 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            <input
              type="text"
              placeholder="Search ANY city, town or mountain in India..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-transparent text-sm placeholder-slate-400 focus:outline-none text-white"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setResults([]);
                }}
                className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-300 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dynamic Search Dropdown */}
          {showDropdown && (
            <div className="absolute top-full mt-2 left-0 right-0 max-h-72 overflow-y-auto rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-2 z-[1010] custom-scrollbar">
              <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold uppercase text-slate-400">
                <span>Dynamic OSM Live Search</span>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-emerald-400 hover:underline"
                >
                  Close
                </button>
              </div>

              {searching ? (
                <div className="p-4 text-center text-xs text-slate-300 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Searching India live via OpenStreetMap...
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {results.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const latNum = parseFloat(r.lat);
                        const lngNum = parseFloat(r.lon);
                        onFlyToCoords(latNum, lngNum, r.name || r.display_name);
                        setShowDropdown(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-500/15 flex items-center justify-between transition-all group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-sm text-white group-hover:text-emerald-300 truncate">
                          {r.name || r.display_name.split(',')[0]}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {r.display_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg shrink-0">
                        <span>Fly</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No locations found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="p-2 text-xs text-slate-400">
                  Type any Indian city, town, or district name above.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Jump City Pills */}
      <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
        <span className="text-[10px] font-bold uppercase text-slate-400 px-1 shrink-0">Quick Fly:</span>
        {quickCities.map(qc => (
          <button
            key={qc.name}
            onClick={() => onFlyToCoords(qc.lat, qc.lng, qc.name)}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-950/80 border border-white/10 text-slate-300 hover:border-emerald-400 hover:text-emerald-300 transition-all shrink-0"
          >
            {qc.name}
          </button>
        ))}
      </div>

      {/* Terrain Layer Switcher */}
      <div className="pointer-events-auto rounded-2xl bg-slate-950/88 backdrop-blur-2xl border border-white/15 shadow-2xl p-2 text-slate-100 flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 pr-2 border-r border-white/10">
          <Layers className="h-3.5 w-3.5 text-amber-400" />
          <span>Terrain Mode</span>
        </div>
        <div className="flex items-center gap-1">
          {layers.map(layer => (
            <button
              key={layer.id}
              onClick={() => onLayerChange(layer.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeLayer === layer.id
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
