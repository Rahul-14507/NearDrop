import React from 'react';
import { IncidentTable } from '../components/incidents/IncidentTable';
import { AssignModal } from '../components/incidents/AssignModal';
import { useIncidents } from '../hooks/useIncidents';

export const IncidentsPage: React.FC = () => {
  const { incidents, loading, resolveIncident, assignIncident, pendingCount, assignedCount } = useIncidents();
  const [assignModalIncidentId, setAssignModalIncidentId] = React.useState<string | null>(null);

  const handleAssignClick = (id: string) => {
    setAssignModalIncidentId(id);
  };

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
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-blue-700">{assignedCount} Assigned</span>
          </div>
        </div>
      </div>



      {/* Incident Table */}
      <IncidentTable
        incidents={incidents}
        loading={loading}
        onResolve={resolveIncident}
        onAssign={handleAssignClick}
      />

      {/* Live Sync Indicator */}
      <p className="text-xs text-emerald-600 font-semibold text-center py-1">
        ⚡ Real-time — incident status updates are pushed live via WebSocket
      </p>

      {assignModalIncidentId && incidents.find(i => i.id === assignModalIncidentId) && (
        <AssignModal
          incident={incidents.find(i => i.id === assignModalIncidentId)!}
          onClose={() => setAssignModalIncidentId(null)}
          onConfirm={(riderId) => {
            assignIncident(assignModalIncidentId, riderId);
            setAssignModalIncidentId(null);
          }}
        />
      )}
    </div>
  );
};
