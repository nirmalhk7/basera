'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  RotateCcw,
  Loader2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { searchDynamicPlaces, NominatimSearchResult, fetchDynamicCityInfo } from '../services/dynamicCityService';
import {
  detectCityAtCoordinates,
  DetectedPlace,
  CITY_ZOOM_THRESHOLD
} from '../utils/geospatialDetector';
import { CityDetectedPanel } from './CityDetectedPanel';

// Dark Cyber Map Tile Layer
const DARK_CYBER_MAP = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  maxZoom: 19
};

const INDIA_CENTER: [number, number] = [22.3511, 78.6677];
const INDIA_DEFAULT_ZOOM = 5;

export default function IndiaTerrainMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(5);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<NominatimSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Geospatial layer detected place state
  const [detectedCity, setDetectedCity] = useState<DetectedPlace | null>(null);
  const [dynamicPlaceName, setDynamicPlaceName] = useState<string | undefined>(undefined);
  const [dynamicStateName, setDynamicStateName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchDynamicPlaces(searchQuery);
      setResults(res);
      setSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounced dynamic fallback for towns not in local index
  const checkDynamicCityFallback = useCallback(async (lat: number, lng: number, zoom: number) => {
    if (zoom < CITY_ZOOM_THRESHOLD) {
      setDynamicPlaceName(undefined);
      setDynamicStateName(undefined);
      return;
    }
    try {
      const info = await fetchDynamicCityInfo(lat, lng);
      if (info && info.name && info.name !== 'Unknown Terrain Location') {
        setDynamicPlaceName(info.name);
        setDynamicStateName(info.state);
      }
    } catch (err) {
      console.warn('Geospatial fallback error:', err);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: INDIA_DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true
    });

    mapInstanceRef.current = map;

    // Add zoom controls cleanly to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Dark Cyber Map tile layer
    tileLayerRef.current = L.tileLayer(DARK_CYBER_MAP.url, {
      attribution: DARK_CYBER_MAP.attribution,
      maxZoom: DARK_CYBER_MAP.maxZoom
    }).addTo(map);

    let debounceTimer: NodeJS.Timeout;

    const handleMoveOrZoom = () => {
      const currentZoom = map.getZoom();
      const center = map.getCenter();
      setZoomLevel(currentZoom);

      // Geospatial city detection layer check
      const localDetected = detectCityAtCoordinates(center.lat, center.lng, currentZoom);
      setDetectedCity(localDetected);

      // If local detection didn't find a place but we're zoomed in, query dynamic Nominatim fallback
      clearTimeout(debounceTimer);
      if (currentZoom >= CITY_ZOOM_THRESHOLD && !localDetected) {
        debounceTimer = setTimeout(() => {
          checkDynamicCityFallback(center.lat, center.lng, currentZoom);
        }, 350);
      } else {
        setDynamicPlaceName(undefined);
        setDynamicStateName(undefined);
      }
    };

    map.on('move', handleMoveOrZoom);
    map.on('zoom', handleMoveOrZoom);

    // Click anywhere on map to smoothly pan/zoom toward it
    map.on('click', (e: L.LeafletMouseEvent) => {
      map.flyTo([e.latlng.lat, e.latlng.lng], Math.max(map.getZoom(), 11), {
        duration: 1.2
      });
    });

    return () => {
      clearTimeout(debounceTimer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [checkDynamicCityFallback]);

  const handleFlyToCoords = (lat: number, lng: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 11, {
        duration: 1.6
      });
    }
  };

  const handleResetIndiaView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(INDIA_CENTER, INDIA_DEFAULT_ZOOM, {
        duration: 1.4
      });
    }
  };

  const quickCities = [
    { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
    { name: 'New Delhi', lat: 28.6139, lng: 77.209 },
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Srinagar', lat: 34.0837, lng: 74.7973 },
    { name: 'Leh (Himalayas)', lat: 34.1526, lng: 77.5771 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
    { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
    { name: 'Varanasi', lat: 25.3176, lng: 82.9739 }
  ];

  const isZoomedInCity = zoomLevel >= CITY_ZOOM_THRESHOLD;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Top Header Bar: Title + Search + Reset View */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pointer-events-none">
        {/* Title & Reset Button */}
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/15 shadow-2xl text-white">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold tracking-tight text-base">INDIA CYBER MAP</span>
          </div>
          <div className="h-4 w-px bg-white/15" />
          <button
            onClick={handleResetIndiaView}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 text-xs font-semibold transition-all border border-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset View
          </button>
        </div>

        {/* Dynamic Search Bar */}
        <div className="pointer-events-auto relative w-full md:w-96">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/15 shadow-2xl text-slate-100">
            {searching ? (
              <Loader2 className="h-4 w-4 text-emerald-400 shrink-0 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            <input
              type="text"
              placeholder="Search any city, town or location in India..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-transparent text-sm placeholder-slate-400 focus:outline-none text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-300 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {showDropdown && (
            <div className="absolute top-full mt-2 left-0 right-0 max-h-72 overflow-y-auto rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-2 z-[1010] custom-scrollbar">
              <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold uppercase text-slate-400">
                <span>Dynamic Search Results</span>
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
                  Searching India...
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1 mt-1">
                  {results.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const latNum = parseFloat(r.lat);
                        const lngNum = parseFloat(r.lon);
                        handleFlyToCoords(latNum, lngNum);
                        setShowDropdown(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-500/15 flex items-center justify-between transition-all group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-sm text-white group-hover:text-emerald-300 truncate">
                          {r.name || r.display_name.split(',')[0]}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{r.display_name}</div>
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
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Top Left Geospatial Detection Panel (under the fly to / header) */}
      <CityDetectedPanel
        detectedCity={detectedCity}
        dynamicPlaceName={dynamicPlaceName}
        dynamicState={dynamicStateName}
        isZoomedIn={isZoomedInCity}
        onCenterCity={handleFlyToCoords}
        onResetView={handleResetIndiaView}
      />

      {/* Quick Fly Cities Strip below top bar */}
      <div className="absolute top-20 left-4 right-4 z-[990] hidden md:flex items-center gap-2 overflow-x-auto pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-lg">
          <span className="text-[10px] font-bold uppercase text-slate-400">Fly to:</span>
          {quickCities.map(qc => (
            <button
              key={qc.name}
              onClick={() => handleFlyToCoords(qc.lat, qc.lng)}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 transition-all border border-transparent hover:border-emerald-500/30 shrink-0"
            >
              {qc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Full Screen Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Minimalist Bottom HUD Badge */}
      <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-2xl border border-white/15 shadow-2xl text-xs text-slate-300 pointer-events-auto">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span>Zoom: <strong className="text-white">{zoomLevel.toFixed(1)}x</strong></span>
      </div>
    </div>
  );
}
