import type { ApiResponse } from '../types/dispatcher.types';
import type { LeaderboardEntry, FailureZone } from '../store/analyticsStore';
import { fetchWithAuth } from './apiClient';

export const AnalyticsApi = {
  getLeaderboard: async (city?: string): Promise<ApiResponse<LeaderboardEntry[]>> => {
    try {
      const queryParam = city && city !== 'All Cities' ? `?city=${encodeURIComponent(city)}` : '';
      const response = await fetchWithAuth(`/api/dispatcher/drivers${queryParam}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      
      let leaderboard: LeaderboardEntry[] = data.map((d: any) => ({
        riderId: String(d.id),
        name: d.name,
        score: d.trust_score,
        completedDeliveries: d.today_completed,
        city: d.city || 'Hyderabad'
      }));

      if (city && city !== 'All Cities') {
        leaderboard = leaderboard.filter((l: any) => l.city.toLowerCase() === city.toLowerCase());
      }

      return {
        success: true,
        data: leaderboard.slice(0, 10), // usually limit top X
      };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  },

  getFailureZones: async (city?: string): Promise<ApiResponse<FailureZone[]>> => {
    // Just mock fallback with respect to city, or fetch real data
    const allZones = [
      { zone: 'Banjara Hills', failedCount: 14, riskLevel: 'high' as const, city: 'Hyderabad' },
      { zone: 'Jubilee Hills', failedCount: 8, riskLevel: 'medium' as const, city: 'Hyderabad' },
      { zone: 'Madhapur', failedCount: 2, riskLevel: 'low' as const, city: 'Hyderabad' },
      { zone: 'Bandra', failedCount: 12, riskLevel: 'high' as const, city: 'Mumbai' },
    ];
    let data = allZones;
    if (city && city !== 'All Cities') {
      data = data.filter(z => z.city.toLowerCase() === city.toLowerCase());
    }

    return { success: true, data };
  },

  getGlobalMetrics: async (city?: string): Promise<ApiResponse<{ avgResTime: number; breachCount: number; rerouteSuccess: number; carbonReduction: number; costSaved: number; }>> => {
    try {
      const queryParam = city && city !== 'All Cities' ? `?city=${encodeURIComponent(city)}` : '';
      const response = await fetchWithAuth(`/api/dispatcher/stats${queryParam}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const d = await response.json();
      
      const rerouteRate = d.success_rate_percent || 0;
      return {
        success: true,
        data: {
          avgResTime: 4.2, // Backend doesn't provide this yet
          breachCount: d.failed_today || 0, // Using failed_today as a proxy for breach
          rerouteSuccess: rerouteRate,
          carbonReduction: d.co2_reduced_percent || 0,
          costSaved: d.cost_saved || 0,
        },
      };
    } catch (error: any) {
      return { success: false, data: { avgResTime: 0, breachCount: 0, rerouteSuccess: 0, carbonReduction: 0, costSaved: 0 }, message: error.message };
    }
  },
};
