import React, { useMemo, useState } from 'react';
import { AlertOctagon, BellRing, CheckCircle2, MapPin, ShieldAlert } from 'lucide-react';
import {
  EMERGENCY_CATEGORIES,
  EmergencyCategory,
  IncidentReport,
  TrustedContact,
  UserProfile,
} from '../types/safety';
import {
  CAMPUS_SECTORS,
  classifyIncidentPriority,
  computeEscalationWorkflow,
  getSectorById,
  simulateContactNotifications,
  validateIncidentInput,
} from '../utils/safetyEngine';
import { CampusMap } from './CampusMap';
import { PriorityBadge } from './StatusBadges';

const CATEGORY_HINTS: Record<EmergencyCategory, string> = {
  'Medical Emergency': 'Injury, fainting, or urgent health aid',
  'Harassment / Stalking': 'Being followed or feeling unsafe',
  'Suspicious Activity': 'Unusual behavior near campus buildings',
  'Late-Night Travel / Escort Needed': 'Request a Safe-Walk escort or shuttle',
  'Physical Threat / Assault': 'Immediate physical danger or threat',
  'Accident / Infrastructure Hazard': 'Dark pathway, broken light, or hazard',
};

interface ReportIncidentViewProps {
  user: UserProfile;
  contacts: TrustedContact[];
  incidents: IncidentReport[];
  initialSectorId?: string;
  initialSosMode?: boolean;
  initialCategory?: EmergencyCategory;
  onSubmitIncident: (params: {
    category: EmergencyCategory;
    description: string;
    sectorId: string;
    simulatedLat: number;
    simulatedLng: number;
    coordinatesShared: boolean;
    isSos: boolean;
    isLateNight: boolean;
    isAlone: boolean;
  }) => Promise<IncidentReport>;
  onNavigateToReports: () => void;
}

export function ReportIncidentView({
  user,
  contacts,
  incidents,
  initialSectorId,
  initialSosMode = false,
  initialCategory,
  onSubmitIncident,
  onNavigateToReports,
}: ReportIncidentViewProps) {
  const [category, setCategory] = useState<EmergencyCategory>(
    initialCategory || (initialSosMode ? 'Harassment / Stalking' : 'Late-Night Travel / Escort Needed')
  );
  const [sectorId, setSectorId] = useState<string>(initialSectorId || CAMPUS_SECTORS[0].id);
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordinatesShared, setCoordinatesShared] = useState<boolean>(true);
  const [isSos, setIsSos] = useState<boolean>(initialSosMode);
  const [isLateNight, setIsLateNight] = useState<boolean>(true);
  const [isAlone, setIsAlone] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedIncident, setSubmittedIncident] = useState<IncidentReport | null>(null);

  React.useEffect(() => {
    if (initialSectorId) {
      setSectorId(initialSectorId);
      setCustomCoords(null);
    }
    if (initialCategory) {
      setCategory(initialCategory);
    } else if (initialSosMode) {
      setCategory('Harassment / Stalking');
    }
    setIsSos(initialSosMode);
  }, [initialSectorId, initialSosMode, initialCategory]);

  const sector = getSectorById(sectorId);
  const activeLat = customCoords ? customCoords.lat : sector.simulatedLat;
  const activeLng = customCoords ? customCoords.lng : sector.simulatedLng;

  const livePriority = useMemo(
    () =>
      classifyIncidentPriority({
        category,
        description,
        isSos,
        isLateNight,
        isAlone,
        sectorId,
      }),
    [category, description, isSos, isLateNight, isAlone, sectorId]
  );

  const liveEscalation = useMemo(
    () =>
      computeEscalationWorkflow({
        category,
        priority: livePriority.priority,
        isSos,
        isLateNight,
        isAlone,
        sectorId,
      }),
    [category, livePriority.priority, isSos, isLateNight, isAlone, sectorId]
  );

  const simulatedContactPreview = useMemo(
    () =>
      simulateContactNotifications(contacts, {
        studentName: user.displayName,
        category,
        sectorName: sector.name,
        priority: livePriority.priority,
        coordinatesShared,
        simulatedLat: activeLat,
        simulatedLng: activeLng,
      }),
    [contacts, user.displayName, category, sector.name, livePriority.priority, coordinatesShared, activeLat, activeLng]
  );

  const handleSelectSectorFromMap = (newSectorId: string, coords?: { lat: number; lng: number }) => {
    setSectorId(newSectorId);
    setCustomCoords(coords || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationError = validateIncidentInput({ description, sectorId });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const created = await onSubmitIncident({
        category,
        description,
        sectorId,
        simulatedLat: activeLat,
        simulatedLng: activeLng,
        coordinatesShared,
        isSos,
        isLateNight,
        isAlone,
      });
      setSubmittedIncident(created);
      setDescription('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit incident report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedIncident) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-[#111827] border border-emerald-500/35 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {submittedIncident.isSos ? 'Emergency SOS Alert Logged' : 'Incident Report Submitted'}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Ref: {submittedIncident.id} · {submittedIncident.sectorName}
                </p>
              </div>
            </div>
            <PriorityBadge priority={submittedIncident.priority} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-blue-400">Assigned Escalation Plan</div>
              <div className="text-sm font-semibold text-slate-100">{submittedIncident.responseCategory}</div>
              <div className="text-xs text-slate-400">{submittedIncident.escalationTier}</div>
              <p className="text-xs text-slate-300 leading-relaxed pt-2">
                <strong className="text-slate-100">Next Step: </strong>
                {submittedIncident.nextActionStudent}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Trusted Contact Alerts ({submittedIncident.notificationLogs.length})
              </div>
              {submittedIncident.notificationLogs.length === 0 ? (
                <p className="text-xs text-slate-400 leading-relaxed">
                  No trusted contacts enabled for SOS notifications. You can add contacts anytime in Emergency Contacts.
                </p>
              ) : (
                <ul className="space-y-2">
                  {submittedIncident.notificationLogs.map((log) => (
                    <li key={log.id} className="text-xs text-slate-300">
                      <span className="font-medium text-slate-100">{log.contactName}</span> ({log.relationship}) · {log.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onNavigateToReports}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Track in My Reports
            </button>
            <button
              type="button"
              onClick={() => setSubmittedIncident(null)}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              Submit Another Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Report Incident or Trigger SOS</h2>
          <p className="text-sm text-slate-400">
            Choose what is happening, confirm your location, and send an alert to campus security.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsSos((prev) => !prev)}
          aria-pressed={isSos}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-2 border whitespace-nowrap shrink-0 ${
            isSos
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-[#111827] border-slate-700 text-slate-200 hover:border-red-500/60'
          }`}
        >
          <AlertOctagon className="w-4 h-4" aria-hidden="true" />
          <span>{isSos ? 'SOS Urgent Mode: Active' : 'Switch to Urgent SOS'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Guided Form (7 cols) */}
        <div className="xl:col-span-7 space-y-6 bg-[#111827] border border-slate-800/90 rounded-xl p-6">
          {/* Category Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-100">
              What kind of help do you need?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EMERGENCY_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    aria-pressed={active}
                    className={`px-4 py-3 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-blue-600/15 border-blue-500 text-white'
                        : 'bg-[#0B1120] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">{cat}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{CATEGORY_HINTS[cat]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sector & Coordinates */}
          <div className="pt-5 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="report-sector" className="block text-sm font-semibold text-slate-100">
                Where are you located?
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coordinatesShared}
                  onChange={(e) => setCoordinatesShared(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B1120] text-blue-600"
                />
                <span>Include simulated GPS coordinates</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <select
                id="report-sector"
                value={sectorId}
                onChange={(e) => {
                  setSectorId(e.target.value);
                  setCustomCoords(null);
                }}
                className="sm:col-span-7 w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {CAMPUS_SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.lightingLevel})
                  </option>
                ))}
              </select>

              <div className="sm:col-span-5 flex items-center justify-end gap-2 text-xs text-slate-300 font-mono tabular-nums">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
                <span>
                  {coordinatesShared
                    ? `${activeLat.toFixed(4)}° N, ${activeLng.toFixed(4)}° E`
                    : 'Withheld'}
                </span>
              </div>
            </div>

            <CampusMap
              selectedSectorId={sectorId}
              onSelectSector={handleSelectSectorFromMap}
              incidents={incidents}
              customCoords={customCoords}
              interactiveCoords
            />
          </div>

          {/* Details & Context */}
          <div className="pt-5 border-t border-slate-800/80 space-y-3">
            <label htmlFor="incident-details" className="block text-sm font-semibold text-slate-100">
              Briefly describe what happened
            </label>
            <div className="flex flex-wrap gap-5">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLateNight}
                  onChange={(e) => setIsLateNight(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B1120] text-blue-600"
                />
                <span>Late-night hours</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAlone}
                  onChange={(e) => setIsAlone(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0B1120] text-blue-600"
                />
                <span>Travelling alone</span>
              </label>
            </div>

            <textarea
              id="incident-details"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share landmarks, who needs help, or what assistance you need…"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 px-5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              isSos ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {submitting
              ? 'Sending Report…'
              : isSos
                ? 'Send Emergency SOS & Notify Contacts'
                : 'Submit Incident Report'}
          </button>
        </div>

        {/* Right Unified Live Assessment Panel (5 cols) */}
        <aside className="xl:col-span-5 bg-[#111827] border border-slate-800/90 rounded-xl p-6 space-y-6">
          {/* Priority Classification */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">Priority Classification</h3>
              </div>
              <PriorityBadge priority={livePriority.priority} />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Calculated Urgency</span>
              <span className="font-mono tabular-nums text-slate-200 font-semibold">
                {livePriority.priorityScore}/100
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
              {livePriority.reasons.map((r, idx) => (
                <li key={idx}>· {r}</li>
              ))}
            </ul>
          </div>

          {/* Escalation Workflow */}
          <div className="pt-5 border-t border-slate-800/80 space-y-3">
            <div className="text-xs font-semibold text-blue-400">Automated Escalation Plan</div>
            <div>
              <div className="text-sm font-semibold text-slate-100">{liveEscalation.responseCategory}</div>
              <div className="text-xs text-slate-400 mt-0.5">{liveEscalation.escalationTier}</div>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-100">Recommended Next Step: </strong>
              {liveEscalation.nextActionStudent}
            </div>
            <div className="space-y-2 pt-1">
              {liveEscalation.workflowSteps.map((step) => (
                <div key={step.step} className="flex items-start gap-2.5 text-xs">
                  <span className="font-mono tabular-nums text-slate-400 shrink-0">0{step.step}.</span>
                  <span className="text-slate-300">
                    <strong className="text-slate-100 font-medium">{step.actor}:</strong> {step.action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Notification Preview */}
          <div className="pt-5 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-slate-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-100">Contacts to Notify</h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {simulatedContactPreview.length} active
              </span>
            </div>
            {simulatedContactPreview.length === 0 ? (
              <p className="text-xs text-slate-400">
                No trusted contacts enabled for automatic SOS alerts.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800/70 text-xs">
                {simulatedContactPreview.map((item) => (
                  <li key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200">
                      {item.contactName} <span className="text-slate-400 font-normal">({item.relationship})</span>
                    </span>
                    <span className="text-slate-400">{item.channel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
