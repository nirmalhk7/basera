'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AreaSelection, GeoPosition, ResearchFeature } from '@/types/research';

interface ResearchMapProps {
  area: AreaSelection | null;
  features: readonly ResearchFeature[];
  selectedFeatureId: string | null;
  onSelectFeature: (feature: ResearchFeature) => void;
  isEditingBoundary: boolean;
  draftBoundary: readonly GeoPosition[];
  onBoundaryPoint: (point: GeoPosition) => void;
  onFinishBoundary: () => void;
  onCancelBoundary: () => void;
}

const INDIA_BOUNDS: L.LatLngBoundsExpression = [[6.5, 68], [37.6, 97.5]];
const INDIA_CENTER: L.LatLngExpression = [22.3511, 78.6677];

const layerColors: Record<string, string> = {
  transport: '#38bdf8',
  roads: '#fbbf24',
  healthcare: '#fb7185',
  education: '#a78bfa',
  daily_needs: '#facc15',
  emergency: '#f43f5e',
  parks: '#4ade80',
  recreation: '#2dd4bf',
  civic: '#22d3ee',
  utilities: '#e879f9',
  water: '#60a5fa',
  land_use: '#f59e0b',
  industrial_waste: '#f97316',
  flood: '#06b6d4',
  air_quality: '#c084fc',
  environmental_clearances: '#84cc16',
  government_plans: '#f97316'
};

function featureStyle(feature: ResearchFeature, selected: boolean): L.PathOptions {
  const color = layerColors[feature.layerId] ?? '#22d3ee';
  return {
    color,
    weight: selected ? 4 : 2,
    opacity: 0.95,
    fillColor: color,
    fillOpacity: selected ? 0.34 : 0.16,
    dashArray: feature.status === 'proposed' || feature.status === 'consultation' || feature.development?.stage === 'rule-potential' ? '7 5' : undefined
  };
}

export function ResearchMap({
  area,
  features,
  selectedFeatureId,
  onSelectFeature,
  isEditingBoundary,
  draftBoundary,
  onBoundaryPoint,
  onFinishBoundary,
  onCancelBoundary,
}: ResearchMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const boundaryLayerRef = useRef<L.FeatureGroup | null>(null);
  const researchLayerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      minZoom: 4.5,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 0.8,
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    boundaryLayerRef.current = L.featureGroup().addTo(map);
    researchLayerRef.current = L.featureGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      boundaryLayerRef.current = null;
      researchLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (isEditingBoundary) onBoundaryPoint([event.latlng.lng, event.latlng.lat]);
    };
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isEditingBoundary, onBoundaryPoint]);

  useEffect(() => {
    const map = mapRef.current;
    const boundaryLayer = boundaryLayerRef.current;
    if (!map || !boundaryLayer) return;

    boundaryLayer.clearLayers();
    if (!area) {
      map.fitBounds(INDIA_BOUNDS, { padding: [28, 28] });
      return;
    }

    L.geoJSON(area.geometry as unknown as GeoJSON.GeoJsonObject, {
      style: {
        color: '#67e8f9',
        weight: 2.5,
        fillColor: '#22d3ee',
        fillOpacity: 0.08,
        dashArray: '6 5'
      }
    }).addTo(boundaryLayer);

    if (isEditingBoundary && draftBoundary.length > 0) {
      L.polyline(
        draftBoundary.map(([longitude, latitude]) => [latitude, longitude] as L.LatLngExpression),
        { color: '#fbbf24', weight: 3, dashArray: '6 5' },
      ).addTo(boundaryLayer);
      draftBoundary.forEach(([longitude, latitude]) => {
        L.circleMarker([latitude, longitude], {
          radius: 5,
          color: '#fbbf24',
          fillColor: '#fbbf24',
          fillOpacity: 0.9,
        }).addTo(boundaryLayer);
      });
    }

    const [west, south, east, north] = area.bbox;
    map.fitBounds([[south, west], [north, east]], { padding: [36, 36], maxZoom: 12 });
  }, [area, draftBoundary, isEditingBoundary]);

  useEffect(() => {
    const layer = researchLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    features.forEach((feature) => {
      if (!feature.geometry) return;
      const selected = feature.id === selectedFeatureId;
      const geoLayer = L.geoJSON(feature.geometry as unknown as GeoJSON.GeoJsonObject, {
        style: () => featureStyle(feature, selected),
        pointToLayer: (_, latLng) => L.circleMarker(latLng, {
          ...featureStyle(feature, selected),
          radius: selected ? 8 : 5,
          fillOpacity: 0.86
        }),
        onEachFeature: (_, renderedLayer) => {
          renderedLayer.on('click', () => onSelectFeature(feature));
          renderedLayer.bindTooltip(feature.title, { direction: 'top', opacity: 0.9, sticky: true });
        }
      });
      geoLayer.addTo(layer);
    });
  }, [features, onSelectFeature, selectedFeatureId]);

  return (
    <section aria-label="Research map" className="relative h-[480px] overflow-hidden bg-slate-950 lg:h-full lg:min-h-0">
      <div ref={containerRef} className="absolute inset-0" />
      {!area ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 m-5 max-w-sm rounded-xl border border-white/10 bg-slate-950/85 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-slate-100">Select and confirm an area</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">The map will draw only boundaries and research evidence returned for your confirmed scope.</p>
        </div>
      ) : null}
      {area && isEditingBoundary ? (
        <div className="pointer-events-auto absolute inset-x-0 top-0 m-5 max-w-sm rounded-xl border border-amber-300/30 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-amber-100">Edit boundary</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Click the map to add points. Need at least three points; the boundary closes automatically.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onFinishBoundary} disabled={draftBoundary.length < 3} className="rounded-md bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Finish boundary</button>
            <button type="button" onClick={onCancelBoundary} className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5">Cancel</button>
          </div>
        </div>
      ) : null}
      {area && !isEditingBoundary ? (
        <div className="pointer-events-none absolute bottom-0 left-0 m-5 max-w-xs rounded-lg border border-cyan-300/20 bg-slate-950/85 px-3 py-2 shadow-xl backdrop-blur">
          <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-200 uppercase">Boundary source</p>
          <p className="mt-1 text-xs text-slate-200">{area.boundary?.sourceType === 'official' ? 'Official' : area.boundary?.sourceType === 'user' ? 'User-drawn' : 'Community'} boundary · {area.boundary?.confidence ?? 'medium'} confidence</p>
        </div>
      ) : null}
    </section>
  );
}
