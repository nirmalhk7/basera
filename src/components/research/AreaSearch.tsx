'use client';

import { FormEvent, useState } from 'react';
import type { AreaSearchResult } from '@/types/research';

export interface AreaSearchSource {
  readonly name: string;
  readonly url: string;
  readonly attribution: string;
}

interface AreaSearchProps {
  results: AreaSearchResult[];
  source: AreaSearchSource | null;
  isSearching: boolean;
  error: string | null;
  selectedArea: AreaSearchResult | null;
  confirmedArea: AreaSearchResult | null;
  hasSearched: boolean;
  onSearch: (query: string) => void;
  onSelect: (area: AreaSearchResult) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onEditBoundary: () => void;
}

function areaMeta(area: AreaSearchResult): string | null {
  return [area.district, area.state].filter(Boolean).join(' · ') || null;
}

export function AreaSearch({
  results,
  source,
  isSearching,
  error,
  selectedArea,
  confirmedArea,
  hasSearched,
  onSearch,
  onSelect,
  onConfirm,
  onCancel,
  onEditBoundary
}: AreaSearchProps) {
  const [query, setQuery] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery) onSearch(nextQuery);
  }

  return (
    <section aria-labelledby="area-search-title" className="border-b border-white/10 px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] text-cyan-300/80 uppercase">Research scope</p>
          <h2 id="area-search-title" className="mt-1 text-sm font-semibold text-white">Choose an administrative area</h2>
        </div>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="area-search-input">Search for an area</label>
        <input
          id="area-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search district, city, or state"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {results.length > 0 ? (
        <>
          <ul aria-label="Area search results" className="mt-3 space-y-1">
            {results.map((area) => {
              const isSelected = selectedArea?.id === area.id;
              const meta = areaMeta(area);
              return (
                <li key={area.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(area)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? 'border-cyan-400/70 bg-cyan-400/10'
                        : 'border-transparent bg-white/[0.035] hover:border-white/10 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="block text-sm font-medium text-slate-100">{area.displayName}</span>
                    {meta ? <span className="mt-0.5 block text-xs text-slate-400">{meta}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {source ? (
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="transition hover:text-cyan-300">
                {source.attribution}
              </a>
            </p>
          ) : null}
        </>
      ) : null}

      {hasSearched && !isSearching && !error && results.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No matching areas returned by the search service.</p>
      ) : null}

      {selectedArea ? (
        <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
          <p className="text-xs text-cyan-100">Selected: <span className="font-semibold">{selectedArea.displayName}</span></p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Confirm this boundary before requesting research layers.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onConfirm} className="rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300">
              Confirm area
            </button>
            <button type="button" onClick={onCancel} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">
              Cancel
            </button>
          </div>
        </div>
      ) : confirmedArea ? (
        <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
          <p className="text-[10px] font-bold tracking-[0.18em] text-emerald-300 uppercase">Boundary confirmed</p>
          <p className="mt-1 text-xs font-semibold text-emerald-100">{confirmedArea.displayName}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {confirmedArea.boundary?.sourceType === 'official' ? 'Official' : confirmedArea.boundary?.sourceType === 'user' ? 'User-drawn' : 'Community'} boundary · {confirmedArea.boundary?.confidence ?? 'medium'} confidence.
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Points stay inside. Crossing lines and polygons are labelled intersects.</p>
          <button type="button" onClick={onEditBoundary} className="mt-3 rounded-md border border-emerald-200/25 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-200/10">
            Edit boundary
          </button>
        </div>
      ) : null}
    </section>
  );
}
