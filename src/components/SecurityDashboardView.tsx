import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, Clock, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  AiIncidentBrief,
  INCIDENT_STATUSES,
  IncidentPriority,
  IncidentReport,
  IncidentStatus,
} from '../types/safety';
import { escalateIncidentTier } from '../utils/safetyEngine';
import { CampusMap } from './CampusMap';
import { PriorityBadge, StatusBadge } from './StatusBadges';

interface SecurityDashboardViewProps {
  incidents: IncidentReport[];
  onUpdateIncidentStatus: (
    incidentId: string,
    updates: {
      status: IncidentStatus;
      assignedUnit: string;
      responderNotes: string;
      priority: IncidentPriority;
      escalationTier: string;
      actionLabel?: string;
    }
  ) => Promise<void>;
}

const PRIORITY_RANK: Record<IncidentPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export function SecurityDashboardView({
  incidents,
  onUpdateIncidentStatus,
}: SecurityDashboardViewProps) {
  const [statusFilter, setStatusFilter] = useState<'Active' | 'All' | IncidentStatus>('Active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<IncidentStatus>('Acknowledged');
  const [draftUnit, setDraftUnit] = useState<string>('');
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState<AiIncidentBrief | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const sortedIncidents = useMemo(() => {
    const filtered = incidents.filter((inc) => {
      if (statusFilter === 'Active') return inc.status !== 'Resolved';
      if (statusFilter === 'All') return true;
      return inc.status === statusFilter;
    });
    return [...filtered].sort((a, b) => {
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [incidents, statusFilter]);

  const activeIncident =
    sortedIncidents.find((i) => i.id === selectedId) || sortedIncidents[0] || null;

  const selectIncident = (inc: IncidentReport) => {
    setSelectedId(inc.id);
    setDraftStatus(inc.status);
    setDraftUnit(inc.assignedUnit || inc.recommendedUnit);
    setDraftNotes(inc.responderNotes || '');
    setSaveSuccess(null);
    setAiBrief(null);
    setAiError(null);
  };

  // Sync draft fields when first loaded or switching filter
  React.useEffect(() => {
    if (activeIncident && activeIncident.id !== selectedId) {
      setSelectedId(activeIncident.id);
      setDraftStatus(activeIncident.status);
      setDraftUnit(activeIncident.assignedUnit || activeIncident.recommendedUnit);
      setDraftNotes(activeIncident.responderNotes || '');
      setAiBrief(null);
      setAiError(null);
    }
  }, [activeIncident, selectedId]);

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIncident) return;
    setSaving(true);
    setSaveSuccess(null);
    try {
      await onUpdateIncidentStatus(activeIncident.id, {
        status: draftStatus,
        assignedUnit: draftUnit,
        responderNotes: draftNotes,
        priority: activeIncident.priority,
        escalationTier: activeIncident.escalationTier,
        actionLabel: `Status set to ${draftStatus}`,
      });
      setSaveSuccess(`Updated ${activeIncident.id} status to ${draftStatus}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAction = async (
    nextStatus: IncidentStatus,
    options?: { escalate?: boolean; actionLabel: string }
  ) => {
    if (!activeIncident || saving) return;
    setSaving(true);
    setSaveSuccess(null);
    try {
      const esc = options?.escalate
        ? escalateIncidentTier(activeIncident)
        : { priority: activeIncident.priority, escalationTier: activeIncident.escalationTier };
      const nextUnit = draftUnit.trim() || activeIncident.assignedUnit || activeIncident.recommendedUnit;
      const nextNotes =
        options?.escalate && !draftNotes.trim()
          ? 'Escalated to Tier 3 Duty Supervisor and external EMS standby simulation.'
          : draftNotes;

      await onUpdateIncidentStatus(activeIncident.id, {
        status: nextStatus,
        assignedUnit: nextUnit,
        responderNotes: nextNotes,
        priority: esc.priority,
        escalationTier: esc.escalationTier,
        actionLabel: options?.actionLabel || `Quick transition to ${nextStatus}`,
      });
      setDraftStatus(nextStatus);
      setDraftUnit(nextUnit);
      setDraftNotes(nextNotes);
      setSaveSuccess(
        options?.escalate
          ? `Escalated ${activeIncident.id} to Tier 3 Critical response.`
          : `Updated ${activeIncident.id} to ${nextStatus}.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAiBrief = async () => {
    if (!activeIncident || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/incident-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident: activeIncident }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI tactical dispatch brief.');
      }
      setAiBrief(data.brief as AiIncidentBrief);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI tactical brief.');
    } finally {
      setAiLoading(false);
    }
  };

  const openCount = incidents.filter((i) => i.status !== 'Resolved').length;
  const criticalCount = incidents.filter((i) => i.status !== 'Resolved' && i.priority === 'Critical').length;
  const dispatchedCount = incidents.filter((i) => i.status === 'Dispatched').length;

  const timelineEntries = useMemo(() => {
    if (!activeIncident) return [];
    if (activeIncident.auditLog && activeIncident.auditLog.length > 0) {
      return activeIncident.auditLog;
    }
    const items = [
      {
        id: 'logged',
        timestamp: activeIncident.createdAt,
        actor: activeIncident.reporterName,
        action: activeIncident.isSos ? 'SOS Beacon Logged' : 'Incident Reported',
        detail: `${activeIncident.category} at ${activeIncident.sectorName}`,
      },
    ];
    if (activeIncident.notificationLogs.length > 0) {
      items.push({
        id: 'notified',
        timestamp: activeIncident.createdAt,
        actor: 'CampusShield Engine',
        action: 'Trusted Contacts Notified (Simulated)',
        detail: `${activeIncident.notificationLogs.length} emergency contact receipt(s) queued.`,
      });
    }
    if (activeIncident.status !== 'Reported') {
      items.push({
        id: 'status',
        timestamp: activeIncident.updatedAt,
        actor: 'Security Command',
        action: `Status: ${activeIncident.status}`,
        detail: activeIncident.assignedUnit
          ? `Assigned to ${activeIncident.assignedUnit}`
          : 'Awaiting unit assignment',
      });
    }
    return items;
  }, [activeIncident]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Security Operations &amp; Admin Console</h2>
          <p className="text-sm text-slate-400">
            Monitor priority-sorted student SOS reports, assign campus patrol units, escalate Tier 3 incidents, and update live response statuses.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400">Open Queue: </span>
            <span className="font-mono tabular-nums font-semibold text-slate-100">{openCount}</span>
          </div>
          <div>
            <span className="text-slate-400">Critical: </span>
            <span className="font-mono tabular-nums font-semibold text-red-400">{criticalCount}</span>
          </div>
          <div>
            <span className="text-slate-400">Dispatched: </span>
            <span className="font-mono tabular-nums font-semibold text-amber-400">{dispatchedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg w-fit">
        {(['Active', 'All', ...INCIDENT_STATUSES] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              statusFilter === tab
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Priority Queue (6 cols) */}
        <div className="xl:col-span-6 space-y-5">
          <CampusMap
            selectedSectorId={activeIncident?.sectorId || 'sector-main-gate'}
            onSelectSector={(sectorId) => {
              const match = sortedIncidents.find((i) => i.sectorId === sectorId);
              if (match) selectIncident(match);
            }}
            incidents={incidents}
          />

          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Priority Incident Queue</h3>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {sortedIncidents.length} shown
              </span>
            </div>

            {sortedIncidents.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No incidents match the current filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {sortedIncidents.map((inc) => {
                  const selected = activeIncident?.id === inc.id;
                  return (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => selectIncident(inc)}
                      className={`w-full text-left p-4 transition-colors space-y-2 ${
                        selected ? 'bg-slate-800/75' : 'hover:bg-slate-800/35'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-400 truncate max-w-[180px]">{inc.id}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityBadge priority={inc.priority} />
                          <StatusBadge status={inc.status} />
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-100">{inc.category}</div>
                      <p className="text-xs text-slate-300 line-clamp-2">{inc.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-300">{inc.reporterName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{inc.reporterStudentId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{inc.sectorName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">Score {inc.priorityScore}/100</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Incident Command & Status Update Form (6 cols) */}
        <div className="xl:col-span-6">
          {!activeIncident ? (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-10 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" aria-hidden="true" />
              <h3 className="text-base font-semibold text-slate-100">Queue Clear</h3>
              <p className="text-sm text-slate-400">Select an incident from the queue or switch filter to view resolved cases.</p>
            </div>
          ) : (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-slate-400">
                    {activeIncident.id} · Reported {new Date(activeIncident.createdAt).toLocaleString()}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 mt-1">{activeIncident.category}</h3>
                  <div className="text-xs text-slate-300 mt-1">
                    Student: <span className="font-medium text-slate-100">{activeIncident.reporterName}</span> ({activeIncident.reporterStudentId})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={activeIncident.priority} />
                  <StatusBadge status={activeIncident.status} />
                </div>
              </div>

              {/* Quick Command Action Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving || activeIncident.status === 'Acknowledged'}
                  onClick={() => handleQuickAction('Acknowledged', { actionLabel: 'Quick Acknowledge' })}
                  className="px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 hover:border-blue-500/60 text-xs font-medium text-slate-200 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  disabled={saving || activeIncident.status === 'Dispatched'}
                  onClick={() => handleQuickAction('Dispatched', { actionLabel: 'Patrol Unit Dispatched' })}
                  className="px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 hover:border-amber-500/60 text-xs font-medium text-amber-300 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  Dispatch Patrol
                </button>
                <button
                  type="button"
                  disabled={saving || (activeIncident.priority === 'Critical' && activeIncident.escalationTier.includes('Tier 3'))}
                  onClick={() =>
                    handleQuickAction('Dispatched', {
                      escalate: true,
                      actionLabel: 'Escalated to Tier 3 Critical',
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 text-xs font-medium text-red-300 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Escalate Tier 3</span>
                </button>
                <button
                  type="button"
                  disabled={saving || activeIncident.status === 'Resolved'}
                  onClick={() => handleQuickAction('Resolved', { actionLabel: 'Marked Resolved' })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 text-xs font-medium text-emerald-300 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  Resolve Case
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400">Reported Details</div>
                <p className="text-sm text-slate-200 leading-relaxed">{activeIncident.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                  <span>{activeIncident.sectorName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {activeIncident.coordinatesShared
                      ? `${activeIncident.simulatedLat.toFixed(4)}° N, ${activeIncident.simulatedLng.toFixed(4)}° E`
                      : 'Coordinates withheld'}
                  </span>
                </div>
              </div>

              {/* Automated Escalation Guidance & AI Tactical Brief */}
              <div className="pt-5 border-t border-slate-800/80 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-blue-400">Escalation Guidance</div>
                    <div className="text-xs text-slate-400 mt-0.5">{activeIncident.escalationTier}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiBrief}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Bot className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                    <span>{aiLoading ? 'Generating Brief…' : 'AI Tactical Brief'}</span>
                  </button>
                </div>
                <div className="text-sm font-medium text-slate-100">{activeIncident.responseCategory}</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-100">Recommended Responder Action: </strong>
                  {activeIncident.nextActionResponder}
                </p>

                {aiError && (
                  <p role="alert" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    {aiError}
                  </p>
                )}

                {aiBrief && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs" data-testid="ai-tactical-brief">
                    <div className="font-semibold text-emerald-400">AI Tactical Dispatch Brief</div>
                    <p className="text-slate-200 leading-relaxed">{aiBrief.riskSummary}</p>
                    <p className="text-slate-300 leading-relaxed">
                      <strong className="text-slate-100">Patrol Directive: </strong>
                      {aiBrief.recommendedPatrolAction}
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      <strong className="text-slate-100">Student Guidance: </strong>
                      {aiBrief.studentSafetyDirective}
                    </p>
                    <ul className="space-y-1 text-slate-300 pt-1">
                      {aiBrief.checkList.map((item, i) => (
                        <li key={i}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Incident Audit Timeline */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Command Audit Timeline</span>
                </div>
                <div className="space-y-2">
                  {timelineEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <div className="text-slate-300">
                        <span className="font-medium text-slate-100">{entry.action}</span>
                        <span className="text-slate-400"> · {entry.detail}</span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-500 shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Update Incident Status Form */}
              <form onSubmit={handleSaveUpdate} className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-sm font-semibold text-slate-100">Detailed Status &amp; Unit Assignment</h4>

                <div>
                  <label htmlFor="admin-status-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Response Status
                  </label>
                  <select
                    id="admin-status-select"
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value as IncidentStatus)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {INCIDENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="admin-unit-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Assigned Patrol / Response Unit
                  </label>
                  <input
                    id="admin-unit-input"
                    type="text"
                    value={draftUnit}
                    onChange={(e) => setDraftUnit(e.target.value)}
                    placeholder="e.g., Unit Alpha-1 & Safe-Walk Escort"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="admin-notes-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Responder Dispatch Notes
                  </label>
                  <textarea
                    id="admin-notes-input"
                    rows={3}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Enter officer dispatch confirmation, ETA, or resolution summary…"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {saveSuccess && (
                  <div
                    role="status"
                    className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Updating Status…' : 'Save Incident Status Update'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
