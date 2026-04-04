import { create } from 'zustand';

export interface LeaderboardEntry {
  riderId: string;
  name: string;
  score: number;
  completedDeliveries: number;
}

export interface FailureZone {
  zone: string;
  failedCount: number;
  riskLevel: 'high' | 'medium' | 'low';
}

interface AnalyticsState {
  riderLeaderboard: LeaderboardEntry[];
  failureZones: FailureZone[];
  avgResolutionTime: number; // in minutes
  slaBreachCount: number;
  rerouteSuccessRate: number; // percentage
  carbonReduction: number;
  costSaved: number;
  
  // Actions
  setLeaderboard: (data: LeaderboardEntry[]) => void;
  setFailureZones: (data: FailureZone[]) => void;
  setGlobalMetrics: (metrics: { avgResTime: number; breachCount: number; rerouteSuccess: number; carbonReduction: number; costSaved: number; }) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  riderLeaderboard: [],
  failureZones: [],
  avgResolutionTime: 0,
  slaBreachCount: 0,
  rerouteSuccessRate: 0,
  carbonReduction: 0,
  costSaved: 0,

  setLeaderboard: (data) => set({ riderLeaderboard: data }),
  setFailureZones: (data) => set({ failureZones: data }),
  setGlobalMetrics: (metrics) => set({
    avgResolutionTime: metrics.avgResTime,
    slaBreachCount: metrics.breachCount,
    rerouteSuccessRate: metrics.rerouteSuccess,
    carbonReduction: metrics.carbonReduction,
    costSaved: metrics.costSaved,
  }),
}));
