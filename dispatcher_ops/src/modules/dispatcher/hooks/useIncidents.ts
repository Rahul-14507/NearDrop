import { useEffect, useState } from 'react';

import { useIncidentStore } from '../store/incidentStore';
import { useCityStore } from '../store/cityStore';
import { IncidentsApi } from '../api/incidentsApi';
import { AuditLogger } from '../services/auditLogger';

export function useIncidents() {
  const { incidents, getActiveIncidents, setIncidents, updateIncidentStatus, upsertIncident } = useIncidentStore();
  const { selectedCity } = useCityStore();
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  useEffect(() => {
    let mounted = true;
    const fetchIncidents = async () => {
      setLoading(true);
      const resp = await IncidentsApi.getActiveIncidents(selectedCity);
      if (mounted && resp.success) {
        setIncidents(resp.data);
      }
      if (mounted) setLoading(false);
    };
    fetchIncidents();
    return () => { mounted = false; };
  }, [setIncidents, selectedCity]);

  const active = getActiveIncidents();

  const resolveIncident = async (incidentId: string) => {
    updateIncidentStatus(incidentId, 'RESOLVED');
    await IncidentsApi.updateIncidentStatus(incidentId, 'RESOLVED');
    AuditLogger.logAction('RESOLVE', 'dispatcher-1', incidentId, 'Manual resolution applied');
  };

  const assignIncident = async (incidentId: string, riderId: string) => {
    const incident = incidents[incidentId];
    if (!incident) return;
    
    updateIncidentStatus(incidentId, 'ASSIGNED');
    upsertIncident({ ...incident, assignedRiderId: riderId, status: 'ASSIGNED' });
    await IncidentsApi.assignIncident(incidentId, riderId);
    AuditLogger.logAction('ASSIGN', 'dispatcher-1', incidentId, `Assigned to ${riderId}`);
  };



  const pendingCount = active.filter((i) => i.status === 'NEW' || i.status === 'PENDING').length;
  const assignedCount = active.filter((i) => i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS').length;


  return {
    incidents: active, // Return array for rendering
    loading,
    resolveIncident,
    assignIncident,
    pendingCount,
    assignedCount,
  };
}
