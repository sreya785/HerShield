import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Radio, ShieldAlert } from 'lucide-react';
import { IncidentPriority, IncidentStatus } from '../types/safety';

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  const styles: Record<IncidentPriority, { classes: string; icon: typeof AlertOctagon }> = {
    Critical: {
      classes: 'text-red-400',
      icon: AlertOctagon,
    },
    High: {
      classes: 'text-amber-400',
      icon: AlertTriangle,
    },
    Medium: {
      classes: 'text-blue-400',
      icon: ShieldAlert,
    },
    Low: {
      classes: 'text-slate-400',
      icon: Clock,
    },
  };

  const config = styles[priority];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${config.classes}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{priority}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const styles: Record<IncidentStatus, { classes: string; icon: typeof Clock }> = {
    Reported: {
      classes: 'text-red-300',
      icon: AlertOctagon,
    },
    Acknowledged: {
      classes: 'text-blue-300',
      icon: Clock,
    },
    Dispatched: {
      classes: 'text-amber-300',
      icon: Radio,
    },
    Resolved: {
      classes: 'text-emerald-400',
      icon: CheckCircle2,
    },
  };

  const config = styles[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${config.classes}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}
