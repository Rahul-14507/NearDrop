import { create } from 'zustand';
import type { Incident, IncidentStatus } from '../types/dispatcher.types';

interface IncidentState {
  incidents: Record<string, Incident>;
  activeIncidentId: string | null;
  
  // Actions
  setIncidents: (incidents: Incident[]) => void;
  upsertIncident: (incident: Incident) => void;
  updateIncidentStatus: (id: string, status: IncidentStatus) => void;
  setActiveIncident: (id: string | null) => void;
  getActiveIncidents: () => Incident[];
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
  incidents: {},
  activeIncidentId: null,

  setIncidents: (incidents: Incident[]) => {
    const record: Record<string, Incident> = {};
    incidents.forEach((inc) => {
      record[inc.id] = inc; // Using id since incidentId is alias
    });
    set({ incidents: record });
  },

  upsertIncident: (incident: Incident) => {
    set((state) => ({
      incidents: {
        ...state.incidents,
        [incident.id]: incident,
      },
    }));
  },

  updateIncidentStatus: (id: string, status: IncidentStatus) => {
    set((state) => {
      const incident = state.incidents[id];
      if (!incident) return state;
      return {
        incidents: {
          ...state.incidents,
          [id]: { ...incident, status },
        },
      };
    });
  },

  setActiveIncident: (id: string | null) => {
    set({ activeIncidentId: id });
  },

  getActiveIncidents: () => {
    return Object.values(get().incidents).filter(
      (inc) => inc.status !== 'RESOLVED' && inc.status !== 'FAILED'
    );
  },
}));
