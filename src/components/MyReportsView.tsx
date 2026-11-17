import React, { useMemo, useState } from 'react';
import { BellRing, FileText, MapPin, Search } from 'lucide-react';
import { INCIDENT_STATUSES, IncidentReport, IncidentStatus } from '../types/safety';
import { PriorityBadge, StatusBadge } from './StatusBadges';

interface MyReportsViewProps {
  incidents: IncidentReport[];
  currentUid: string;
  isAdmin: boolean;
  onCreateNewReport: () => void;
}

export function MyReportsView({
  incidents,
  currentUid,
  isAdmin,
  onCreateNewReport,
}: MyReportsViewProps) {
  const [statusFilter, setStatusFilter] = useState<'All' | IncidentStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleIncidents = useMemo(() => {
    const base = isAdmin
      ? incidents
      : incidents.filter((inc) => inc.reporterUid === currentUid);

    return base.filter((inc) => {
      const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        inc.category.toLowerCase().includes(q) ||
        inc.sectorName.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [incidents, isAdmin, currentUid, statusFilter, searchQuery]);

  const activeIncident =
    visibleIncidents.find((i) => i.id === selectedId) || visibleIncidents[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Emergency Reports</h2>
          <p className="text-sm text-slate-400">
            Track submitted SOS alerts, priority triage, escalation actions, and responder status updates.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNewReport}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          New Emergency Report
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
          {(['All', ...INCIDENT_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === status
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sector, category, or ID…"
            aria-label="Search emergency reports"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {visibleIncidents.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-500 mx-auto" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-200">No Matching Reports Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Submit an SOS or incident report to track real-time security status updates and automated escalation recommendations.
          </p>
          <button
            type="button"
            onClick={onCreateNewReport}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            Submit First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Reports List (5 cols) */}
          <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
            {visibleIncidents.map((inc) => {
              const selected = activeIncident?.id === inc.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedId(inc.id)}
                  className={`w-full text-left p-4 transition-colors space-y-2 ${
                    selected ? 'bg-slate-800/70' : 'hover:bg-slate-800/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-400">{inc.id}</span>
                    <StatusBadge status={inc.status} />
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{inc.category}</div>
                  <p className="text-xs text-slate-300 line-clamp-2">{inc.description}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                    <span>{inc.sectorName}</span>
                    <PriorityBadge priority={inc.priority} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Report Details Inspector (7 cols) */}
          {activeIncident && (
            <div className="lg:col-span-7 bg-[#111827] border border-slate-800/90 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>{activeIncident.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(activeIncident.createdAt).toLocaleString()}</span>
                    {activeIncident.isSos && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-400 font-semibold">SOS Urgent</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">{activeIncident.category}</h3>
                </div>
                <div className="flex items-center gap-4">
                  <PriorityBadge priority={activeIncident.priority} />
                  <StatusBadge status={activeIncident.status} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-400">Incident Description</div>
                <p className="text-sm text-slate-200 leading-relaxed">{activeIncident.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-slate-800/80 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-400">Location &amp; Coordinates</div>
                  <div className="text-sm font-medium text-slate-100">{activeIncident.sectorName}</div>
                  <div className="font-mono tabular-nums text-slate-300 flex items-center gap-1.5 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                    {activeIncident.coordinatesShared
                      ? `${activeIncident.simulatedLat.toFixed(4)}° N, ${activeIncident.simulatedLng.toFixed(4)}° E`
                      : 'Coordinates withheld'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-400">Security Dispatch Update</div>
                  <div className="text-sm font-medium text-slate-100">
                    {activeIncident.assignedUnit || 'Awaiting Unit Assignment'}
                  </div>
                  <div className="text-slate-300 pt-0.5 leading-relaxed">
                    {activeIncident.responderNotes || 'No responder notes logged yet.'}
                  </div>
                </div>
              </div>

              {/* Escalation Protocol */}
              <div className="pt-5 border-t border-slate-800/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-blue-400">Escalation Protocol</span>
                  <span className="text-xs text-slate-400">{activeIncident.escalationTier}</span>
                </div>
                <div className="text-sm font-medium text-slate-100">{activeIncident.responseCategory}</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-100">Recommended Next Step:</strong> {activeIncident.nextActionStudent}
                </p>
              </div>

              {/* Simulated Notification Log */}
              <div className="space-y-3 pt-5 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <BellRing className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span>Contact Alert Receipts ({activeIncident.notificationLogs.length})</span>
                </div>
                {activeIncident.notificationLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">No simulated contact notifications recorded for this report.</p>
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {activeIncident.notificationLogs.map((log) => (
                      <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-slate-100">
                            {log.contactName} · {log.relationship}
                          </span>
                          <span className="text-emerald-400 font-medium">{log.status}</span>
                        </div>
                        <p className="text-slate-400">{log.messagePreview}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
