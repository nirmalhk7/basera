import React from 'react';
import MapContainerWrapper from '../components/MapContainerWrapper';

export const metadata = {
  title: 'India Terrain Explorer | Interactive Topographic & Elevation Map',
  description: 'Interactive terrain-style map of India with live topographic relief, elevation shading, and dynamic location telemetry.'
};

export default function HomePage() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-950">
      <MapContainerWrapper />
    </main>
  );
}
