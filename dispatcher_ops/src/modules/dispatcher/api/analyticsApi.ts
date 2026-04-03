import type { ApiResponse } from '../types/dispatcher.types';
import type { LeaderboardEntry, FailureZone } from '../store/analyticsStore';
import { fetchWithAuth } from './apiClient';

export const AnalyticsApi = {
  getLeaderboard: async (): Promise<ApiResponse<LeaderboardEntry[]>> => {
    try {
      const response = await fetchWithAuth('/api/dispatcher/drivers');
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      
      const leaderboard: LeaderboardEntry[] = data.map((d: any) => ({
        riderId: String(d.id),
        name: d.name,
        score: d.trust_score,
        completedDeliveries: d.today_completed
      }));

      return {
        success: true,
        data: leaderboard,
      };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  },

  getFailureZones: async (): Promise<ApiResponse<FailureZone[]>> => {
    // Backend doesn't have a direct "failure zones" yet, we'll derive it from stats
    // or just use a fixed list for now but with live stats if possible.
    // For now, let's keep it as is or fetch from a new endpoint.
    return {
      success: true,
      data: [
        { zone: 'Banjara Hills', failedCount: 14, riskLevel: 'high' },
        { zone: 'Jubilee Hills', failedCount: 8, riskLevel: 'medium' },
        { zone: 'Madhapur', failedCount: 2, riskLevel: 'low' },
      ],
    };
  },

  getGlobalMetrics: async (): Promise<ApiResponse<{ avgResTime: number; breachCount: number; rerouteSuccess: number; }>> => {
    try {
      const response = await fetchWithAuth('/api/dispatcher/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const d = await response.json();
      
      return {
        success: true,
        data: {
          avgResTime: 4.2, // Backend doesn't provide this yet
          breachCount: d.failed_today, // Using failed_today as a proxy for breach
          rerouteSuccess: d.success_rate_percent,
        },
      };
    } catch (error: any) {
      return { success: false, data: { avgResTime: 0, breachCount: 0, rerouteSuccess: 0 }, message: error.message };
    }
  },
};
