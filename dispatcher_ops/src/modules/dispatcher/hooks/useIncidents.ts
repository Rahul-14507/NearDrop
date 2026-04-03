import { useEffect, useState } from 'react';

import { useIncidentStore } from '../store/incidentStore';
import { useRiderStore } from '../store/riderStore';
import { IncidentsApi } from '../api/incidentsApi';
import { AssignmentEngine } from '../services/assignmentEngine';
import { AuditLogger } from '../services/auditLogger';

export function useIncidents() {
  const { incidents, getActiveIncidents, setIncidents, updateIncidentStatus, upsertIncident } = useIncidentStore();
  const { getOnlineRiders } = useRiderStore();
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  useEffect(() => {
    let mounted = true;
    const fetchIncidents = async () => {
      const resp = await IncidentsApi.getActiveIncidents();
      if (mounted && resp.success) {
        setIncidents(resp.data);
      }
      if (mounted) setLoading(false);
    };
    fetchIncidents();
    return () => { mounted = false; };
  }, [setIncidents]);

  const active = getActiveIncidents();

  const resolveIncident = async (incidentId: string) => {
    updateIncidentStatus(incidentId, 'RESOLVED');
    await IncidentsApi.updateIncidentStatus(incidentId, 'RESOLVED');
    AuditLogger.logAction('RESOLVE', 'dispatcher-1', incidentId, 'Manual resolution applied');
  };

  const escalateIncident = async (incidentId: string) => {
    updateIncidentStatus(incidentId, 'ESCALATED');
    await IncidentsApi.updateIncidentStatus(incidentId, 'ESCALATED');
    AuditLogger.logAction('ESCALATE', 'dispatcher-1', incidentId, 'Manual escalation triggered');
  };

  const autoAssign = async (incidentId: string) => {
    const incident = incidents[incidentId];
    if (!incident) return;
    
    // Engine recommends
    const { recommendedRiderId } = AssignmentEngine.recommendRider(incident, getOnlineRiders());
    
    if (recommendedRiderId) {
      updateIncidentStatus(incidentId, 'ASSIGNED');
      // Optimistic update
      upsertIncident({ ...incident, assignedRiderId: recommendedRiderId, status: 'ASSIGNED' });
      await IncidentsApi.assignIncident(incidentId, recommendedRiderId);
      AuditLogger.logAction('AUTO_ASSIGN', 'system-engine', incidentId, `Assigned to ${recommendedRiderId}`);
    }
  };

  const pendingCount = active.filter((i) => i.status === 'NEW' || i.status === 'PENDING').length;
  const assignedCount = active.filter((i) => i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS').length;
  const escalatedCount = active.filter((i) => i.status === 'ESCALATED').length;

  return {
    incidents: active, // Return array for rendering
    loading,
    resolveIncident,
    escalateIncident,
    autoAssign,
    pendingCount,
    assignedCount,
    escalatedCount,
  };
}
