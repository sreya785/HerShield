import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Footprints, Navigation, ShieldCheck } from 'lucide-react';
import { IncidentReport } from '../types/safety';
import { CAMPUS_SECTORS, computeSafeRoute } from '../utils/safetyEngine';
import { CampusMap } from './CampusMap';

interface SafeRoutePlannerViewProps {
  incidents: IncidentReport[];
  onRequestEscort: (originSectorId: string) => void;
}

export function SafeRoutePlannerView({
  incidents,
  onRequestEscort,
}: SafeRoutePlannerViewProps) {
  const [originId, setOriginId] = useState<string>('sector-engineering-block');
  const [destinationId, setDestinationId] = useState<string>('sector-main-gate');
  const [mode, setMode] = useState<'walking' | 'shuttle'>('walking');
  const [isLateNight, setIsLateNight] = useState<boolean>(true);
  const [activeRouteKey, setActiveRouteKey] = useState<'safest' | 'fastest'>('safest');

  const routePlan = useMemo(
    () =>
      computeSafeRoute(originId, destinationId, incidents, {
        isLateNight,
        mode,
      }),
    [originId, destinationId, incidents, isLateNight, mode]
  );

  const displayedRoute = activeRouteKey === 'safest' ? routePlan.safest : routePlan.fastest;
  const highlightedIds = displayedRoute.sectors.map((s) => s.id);

  const handleSwap = () => {
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Safe Route Planner</h2>
          <p className="text-sm text-slate-400">
            Compute illuminated campus transit paths weighted by active incident zones, guard post proximity, and lighting coverage.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRequestEscort(originId)}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          Request Safe-Walk Escort
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls & Route Cards (5 cols) */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="route-origin" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Origin Sector
                </label>
                <select
                  id="route-origin"
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {CAMPUS_SECTORS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shortCode} · {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Swap Origin &amp; Destination</span>
                </button>
              </div>

              <div>
                <label htmlFor="route-dest" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Destination Sector
                </label>
                <select
                  id="route-dest"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {CAMPUS_SECTORS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shortCode} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode('walking')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                    mode === 'walking' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Walking</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('shuttle')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                    mode === 'shuttle' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Night Shuttle</span>
                </button>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLateNight}
                  onChange={(e) => setIsLateNight(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B1120] text-blue-600"
                />
                <span>Late-Night Mode</span>
              </label>
            </div>
          </div>

          {/* Route Comparison Selector */}
          <div className="space-y-3">
            {(['safest', 'fastest'] as const).map((key) => {
              const option = routePlan[key];
              const isSelected = activeRouteKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveRouteKey(key)}
                  aria-pressed={isSelected}
                  className={`w-full text-left p-4 rounded-xl border transition-colors space-y-2.5 ${
                    isSelected
                      ? 'bg-[#161F33] border-emerald-500/60'
                      : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-100">{option.label}</span>
                    <span className="text-xs font-mono tabular-nums text-emerald-400 font-semibold">
                      Score {option.safetyScore}/10
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono tabular-nums">
                    <span>{option.totalMinutes} min</span>
                    <span aria-hidden="true">·</span>
                    <span>{option.lightingCoveragePercent}% Lit</span>
                    <span aria-hidden="true">·</span>
                    <span>{option.guardPostsPassed} Guard Posts</span>
                    <span aria-hidden="true">·</span>
                    <span className={option.activeAlertsOnPath > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                      {option.activeAlertsOnPath} Active Alert(s)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Map & Turn-by-Turn Checkpoints (7 cols) */}
        <div className="xl:col-span-7 space-y-5">
          <CampusMap
            selectedSectorId={destinationId}
            onSelectSector={(id) => setDestinationId(id)}
            incidents={incidents}
            highlightedRouteSectorIds={highlightedIds}
          />

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Turn-by-Turn Checkpoints · {displayedRoute.label}
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {displayedRoute.sectors.map((s) => s.shortCode).join(' → ')}
              </span>
            </div>

            <ol className="space-y-2.5 pt-1 text-xs text-slate-300">
              {displayedRoute.turnByTurn.map((stepText, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums text-emerald-400 shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{stepText}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
