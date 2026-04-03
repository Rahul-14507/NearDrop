import { create } from 'zustand';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  acknowledged: boolean;
  relatedEntityId?: string; // e.g. 'hub-1' or 'rider-2'
}

interface AlertState {
  alerts: Alert[];
  
  // Actions
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  clearResolvedTips: () => void;
  getUnacknowledgedCount: () => number;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],

  addAlert: (alert: Alert) => {
    set((state) => ({
      alerts: [alert, ...state.alerts],
    }));
  },

  acknowledgeAlert: (id: string) => {
    set((state) => ({
      alerts: state.alerts.map((alert) => 
        alert.id === id ? { ...alert, acknowledged: true } : alert
      ),
    }));
  },

  clearResolvedTips: () => {
    set((state) => ({
      alerts: state.alerts.filter((alert) => !alert.acknowledged || alert.severity === 'critical'),
    }));
  },

  getUnacknowledgedCount: () => {
    return get().alerts.filter((a) => !a.acknowledged).length;
  },
}));
