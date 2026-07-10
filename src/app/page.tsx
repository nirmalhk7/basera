import React from 'react';
import MapContainerWrapper from '../components/MapContainerWrapper';

export const metadata = {
  title: 'Basera | Interactive India Terrain & Geospatial Explorer',
  description: 'Interactive terrain-style map of India with live administrative border detection, demographic profiles, and climate telemetry.'
};

export default function HomePage() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-950">
      <MapContainerWrapper />
    </main>
  );
}
