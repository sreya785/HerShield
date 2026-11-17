import React, { useState } from 'react';
import { AlertOctagon, Compass, MapPin, ShieldCheck, Users } from 'lucide-react';
import { IncidentReport, SafetyCheckinResult, TrustedContact } from '../types/safety';
import { CAMPUS_SECTORS, evaluateSectorSafetyCheckin, getSectorById } from '../utils/safetyEngine';
import { CampusMap } from './CampusMap';
import { PriorityBadge, StatusBadge } from './StatusBadges';

interface SafetyStatusViewProps {
  incidents: IncidentReport[];
  contacts: TrustedContact[];
  onTriggerQuickSos: (sectorId: string) => void;
  onNavigate: (tab: 'report' | 'contacts' | 'reports' | 'route' | 'assistant') => void;
}

export function SafetyStatusView({
  incidents,
  contacts,
  onTriggerQuickSos,
  onNavigate,
}: SafetyStatusViewProps) {
  const [selectedSectorId, setSelectedSectorId] = useState<string>(CAMPUS_SECTORS[0].id);
  const [isLateNightCheck, setIsLateNightCheck] = useState<boolean>(false);
  const [checkinResult, setCheckinResult] = useState<SafetyCheckinResult>(() =>
    evaluateSectorSafetyCheckin(CAMPUS_SECTORS[0].id, incidents, false)
  );

  const selectedSector = getSectorById(selectedSectorId);
  const activeIncidents = incidents.filter((i) => i.status !== 'Resolved');
  const activeNotifyContacts = contacts.filter((c) => c.notifyOnSos);

  const handleSelectSector = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    setCheckinResult(evaluateSectorSafetyCheckin(sectorId, incidents, isLateNightCheck));
  };

  const handleCheckSafety = (e: React.FormEvent) => {
    e.preventDefault();
    const res = evaluateSectorSafetyCheckin(selectedSectorId, incidents, isLateNightCheck);
    setCheckinResult(res);
  };

  const scoreColorClass =
    checkinResult.safetyScore >= 8
      ? 'text-emerald-400'
      : checkinResult.safetyScore >= 5
        ? 'text-amber-400'
        : 'text-red-400';

  const scoreBarClass =
    checkinResult.safetyScore >= 8
      ? 'bg-emerald-500'
      : checkinResult.safetyScore >= 5
        ? 'bg-amber-400'
        : 'bg-red-500';

  return (
    <div className="space-y-6">
      {/* Top 4-Column Glanceable Campus Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800/90 rounded-xl px-5 py-4">
          <div className="text-xs text-slate-400">Active Campus Alerts</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
            {activeIncidents.length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Across {CAMPUS_SECTORS.length} monitored zones</div>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-xl px-5 py-4">
          <div className="text-xs text-slate-400">Selected Zone Score</div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${scoreColorClass}`}>
            {checkinResult.safetyScore}/10
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{checkinResult.riskLabel}</div>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-xl px-5 py-4">
          <div className="text-xs text-slate-400">Patrol Frequency</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
            {selectedSector.patrolIntervalMinutes} min
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{selectedSector.nearestGuardPost}</div>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-xl px-5 py-4">
          <div className="text-xs text-slate-400">Trusted Contacts</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {activeNotifyContacts.length} Ready
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Auto-notified on SOS</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Main Map & Sector Feed (Left 8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          <CampusMap
            selectedSectorId={selectedSectorId}
            onSelectSector={handleSelectSector}
            incidents={incidents}
          />

          {/* Selected Location Details */}
          <div className="bg-[#111827] border border-slate-800/90 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{selectedSector.zoneType} Zone</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {selectedSector.simulatedLat.toFixed(4)}° N, {selectedSector.simulatedLng.toFixed(4)}° E
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-slate-100 mt-1">{selectedSector.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => onTriggerQuickSos(selectedSector.id)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Report Issue Here
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 text-sm">
              <div>
                <div className="text-xs text-slate-400">Nearest Guard Post</div>
                <div className="font-medium text-slate-200 mt-1">{selectedSector.nearestGuardPost}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Lighting Condition</div>
                <div className="font-medium text-slate-200 mt-1">{selectedSector.lightingLevel}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Patrol Cadence</div>
                <div className="font-medium text-slate-200 font-mono tabular-nums mt-1">
                  Every {selectedSector.patrolIntervalMinutes} min
                </div>
              </div>
            </div>

            {/* Active Campus Alerts Inline Section */}
            <div className="pt-5 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-slate-100">Active Campus Alerts</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View All Reports
                </button>
              </div>

              {activeIncidents.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">
                  All campus locations are clear with no open incident reports.
                </p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {activeIncidents.slice(0, 4).map((inc) => (
                    <div
                      key={inc.id}
                      className="py-3 first:pt-1 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-medium text-slate-200">{inc.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{inc.sectorName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 truncate">{inc.description}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <PriorityBadge priority={inc.priority} />
                        <StatusBadge status={inc.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Unified Safety Actions & Check-In Panel (4 cols) */}
        <aside className="xl:col-span-4 bg-[#111827] border border-slate-800/90 rounded-xl p-6 space-y-6">
          {/* Emergency Action Block */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">Need Immediate Help?</h2>
            <button
              type="button"
              onClick={() => onTriggerQuickSos(selectedSectorId)}
              className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
            >
              <AlertOctagon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Trigger Emergency SOS</span>
            </button>
            <p className="text-xs text-slate-400 leading-relaxed">
              Alerts campus security and simulates instant notifications to your trusted contacts.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('route')}
                className="px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-emerald-500/50 text-xs font-medium text-slate-200 transition-colors text-center"
              >
                Plan Safe Route
              </button>
              <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className="px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-blue-500/50 text-xs font-medium text-slate-200 transition-colors text-center"
              >
                Ask Safety AI
              </button>
            </div>
          </div>

          {/* Safety Check-In Section */}
          <div className="pt-6 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-100">Location Safety Check</h3>
              <Compass className="w-4 h-4 text-blue-400" aria-hidden="true" />
            </div>

            <form onSubmit={handleCheckSafety} className="space-y-3">
              <div>
                <label htmlFor="checkin-location" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Choose Campus Location
                </label>
                <select
                  id="checkin-location"
                  value={selectedSectorId}
                  onChange={(e) => handleSelectSector(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {CAMPUS_SECTORS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.lightingLevel})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLateNightCheck}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsLateNightCheck(checked);
                    setCheckinResult(evaluateSectorSafetyCheckin(selectedSectorId, incidents, checked));
                  }}
                  className="rounded border-slate-600 bg-[#0B1120] text-blue-600 focus:ring-blue-500"
                />
                <span>Check for late-night travel (21:00–05:00)</span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors"
              >
                Check Safety
              </button>
            </form>

            <div className="pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{checkinResult.riskLabel}</span>
                <span
                  className={`text-base font-bold font-mono tabular-nums ${scoreColorClass}`}
                  data-testid="safety-score-value"
                >
                  {checkinResult.safetyScore}/10
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#0B1120] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${scoreBarClass}`}
                  style={{ width: `${checkinResult.safetyScore * 10}%` }}
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Recommended Precautions</span>
                </div>
                <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
                  {checkinResult.safetyTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Trusted Contacts Summary */}
          <div className="pt-6 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">Trusted Contacts</h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-emerald-400 font-medium">
                {activeNotifyContacts.length} active
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeNotifyContacts.length > 0
                ? `${activeNotifyContacts.map((c) => c.name).join(', ')} will receive simulated alerts.`
                : 'Add family or friends to notify during an emergency.'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('contacts')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Manage Emergency Contacts</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
