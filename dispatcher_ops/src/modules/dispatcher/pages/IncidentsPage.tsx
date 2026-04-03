import React from 'react';
import { IncidentTable } from '../components/incidents/IncidentTable';
import { useIncidents } from '../hooks/useIncidents';

export const IncidentsPage: React.FC = () => {
  const { incidents, loading, resolveIncident, escalateIncident, autoAssign, pendingCount, assignedCount, escalatedCount } = useIncidents();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Incident Queue</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage and resolve active delivery failures in real-time</p>
        </div>

        {/* Summary Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-amber-700">{pendingCount} Pending</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-red-700">{escalatedCount} Escalated</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-blue-700">{assignedCount} Assigned</span>
          </div>
        </div>
      </div>

      {/* Alert Banner for Escalated incidents */}
      {escalatedCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl border"
          style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-semibold text-red-700">
            {escalatedCount} incident{escalatedCount > 1 ? 's' : ''} requiring immediate attention
          </p>
        </div>
      )}

      {/* Incident Table */}
      <IncidentTable
        incidents={incidents}
        loading={loading}
        onResolve={resolveIncident}
        onEscalate={escalateIncident}
        onAutoAssign={autoAssign}
      />

      {/* Live Sync Indicator */}
      <p className="text-xs text-emerald-600 font-semibold text-center py-1">
        ⚡ Real-time — incident status updates are pushed live via WebSocket
      </p>
    </div>
  );
};
