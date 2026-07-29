'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ResearchWorkspace = dynamic(
  () => import('./research/ResearchWorkspace').then((module) => module.ResearchWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 gap-4">
        <div className="h-10 w-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-semibold tracking-wide text-cyan-300 uppercase">
          Loading Basera Research Map...
        </div>
      </div>
    )
  }
);

export default function MapContainerWrapper() {
  return <ResearchWorkspace />;
}
