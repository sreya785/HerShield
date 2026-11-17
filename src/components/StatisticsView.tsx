import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import { IncidentPriority, IncidentReport } from '../types/safety';
import { computeIncidentStatistics, formatIncidentsCsv } from '../utils/safetyEngine';
import { CampusDangerHeatmap } from './CampusDangerHeatmap';
import { PriorityBadge, StatusBadge } from './StatusBadges';

interface StatisticsViewProps {
  incidents: IncidentReport[];
}

export function StatisticsView({ incidents }: StatisticsViewProps) {
  const [priorityFilter, setPriorityFilter] = useState<'All' | IncidentPriority>('All');

  const stats = useMemo(() => computeIncidentStatistics(incidents), [incidents]);
  const maxCategoryCount = Math.max(1, ...stats.byCategory.map((c) => c.count));
  const maxSectorCount = Math.max(1, ...stats.bySector.map((s) => s.count));
  const maxPriorityCount = Math.max(1, ...stats.byPriority.map((p) => p.count));
  const maxStatusCount = Math.max(1, ...stats.byStatus.map((s) => s.count));

  const filteredHistory = useMemo(() => {
    if (priorityFilter === 'All') return incidents;
    return incidents.filter((i) => i.priority === priorityFilter);
  }, [incidents, priorityFilter]);

  const handleExportCsv = () => {
    const csv = formatIncidentsCsv(filteredHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campusshield-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const priorityBarColor: Record<IncidentPriority, string> = {
    Critical: 'bg-red-500',
    High: 'bg-orange-500',
    Medium: 'bg-amber-400',
    Low: 'bg-emerald-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Incident History &amp; Statistics</h2>
          <p className="text-sm text-slate-400">
            Campus-wide emergency volume, priority distribution, sector hotspots, and historical audit log.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredHistory.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111827] border border-slate-700 hover:border-blue-500/60 text-xs font-semibold text-slate-100 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span>Download CSV ({filteredHistory.length})</span>
        </button>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Logged Incidents',
            value: stats.totalIncidents,
            sub: `${stats.sosCount} SOS alerts`,
            color: 'text-slate-100',
            testId: 'stat-total-incidents',
          },
          {
            label: 'Active / Open Cases',
            value: stats.activeIncidents,
            sub: 'Awaiting resolution',
            color: 'text-amber-400',
          },
          {
            label: 'Critical & High Priority',
            value: stats.criticalOrHighCount,
            sub: 'Auto-escalated tier',
            color: 'text-red-400',
          },
          {
            label: 'Resolution Rate',
            value: `${stats.resolvedRatePercent}%`,
            sub: `${stats.resolvedCount} of ${stats.totalIncidents} resolved`,
            color: 'text-emerald-400',
          },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.04 }}
            className="bg-[#111827] border border-slate-800/90 rounded-xl p-5 space-y-1"
          >
            <div className="text-xs text-slate-400">{kpi.label}</div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${kpi.color}`}
              data-testid={kpi.testId}
            >
              {kpi.value}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">{kpi.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* D3 Campus Danger Heatmap over Real Campus Map */}
      <CampusDangerHeatmap incidents={incidents} priorityFilter={priorityFilter} />

      {/* Category & Sector Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Incidents by Emergency Category</h3>
          <div className="space-y-3">
            {stats.byCategory.map((item) => {
              const pct = Math.round((item.count / maxCategoryCount) * 100);
              return (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.category}</span>
                    <span className="font-mono tabular-nums text-slate-200 font-medium">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B1120] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${item.count === 0 ? 0 : Math.max(6, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Incidents by Campus Sector</h3>
          <div className="space-y-3">
            {stats.bySector.map((item) => {
              const pct = Math.round((item.count / maxSectorCount) * 100);
              return (
                <div key={item.sectorId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.sectorName}</span>
                    <span className="font-mono tabular-nums text-slate-200 font-medium">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B1120] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${item.count === 0 ? 0 : Math.max(6, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Priority & Response Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Priority Severity Breakdown</h3>
          <div className="space-y-3">
            {stats.byPriority.map((item) => {
              const pct = Math.round((item.count / maxPriorityCount) * 100);
              return (
                <div key={item.priority} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.priority}</span>
                    <span className="font-mono tabular-nums text-slate-200 font-medium">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B1120] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${priorityBarColor[item.priority]}`}
                      style={{ width: `${item.count === 0 ? 0 : Math.max(6, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Response Lifecycle Status</h3>
          <div className="space-y-3">
            {stats.byStatus.map((item) => {
              const pct = Math.round((item.count / maxStatusCount) * 100);
              return (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.status}</span>
                    <span className="font-mono tabular-nums text-slate-200 font-medium">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B1120] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${item.count === 0 ? 0 : Math.max(6, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historical Incident Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-100">Historical Incident Log</h3>
          <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
            {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  priorityFilter === p
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-3 px-6 font-medium">Reference</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Campus Sector</th>
                <th className="py-3 px-4 font-medium">Priority</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-6 font-medium text-right">Logged Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                    No incidents match the selected priority filter.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs text-slate-300 whitespace-nowrap">{inc.id}</td>
                    <td className="py-3 px-4 text-slate-100 font-medium">{inc.category}</td>
                    <td className="py-3 px-4 text-slate-300">{inc.sectorName}</td>
                    <td className="py-3 px-4">
                      <PriorityBadge priority={inc.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-slate-400 whitespace-nowrap">
                      {new Date(inc.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
