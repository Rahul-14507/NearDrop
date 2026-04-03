import { fetchWithAuth } from './apiClient';
import type { Rider, ApiResponse, RiderStatus } from '../types/dispatcher.types';

export const RidersApi = {
  getRealtimeFleet: async (): Promise<ApiResponse<Rider[]>> => {
    try {
      const response = await fetchWithAuth('/api/dispatcher/drivers');
      if (!response.ok) throw new Error('Failed to fetch drivers');
      const data = await response.json();
      
      const riders: Rider[] = data.map((d: any) => ({
        id: String(d.id),
        name: d.name,
        zone: mapLocationToZone(d.current_lat, d.current_lng),
        score: d.trust_score,
        status: d.is_active ? 'online' : 'offline',
        load: d.today_assigned,
        etaToHub: 10, // Simulated
        lastActiveTimestamp: new Date().toISOString(),
        coordinates: { lat: d.current_lat, lng: d.current_lng }
      }));

      return {
        success: true,
        data: riders,
      };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  },

  getRiderById: async (id: string): Promise<ApiResponse<Rider | null>> => {
    try {
      const response = await fetchWithAuth(`/api/dispatcher/drivers/${id}`);
      if (!response.ok) throw new Error('Failed to fetch rider');
      const d = await response.json();
      
      const rider: Rider = {
        id: String(d.id),
        name: d.name,
        zone: mapLocationToZone(d.current_lat, d.current_lng),
        score: d.trust_score,
        status: d.is_active ? 'online' : 'offline',
        load: d.today_assigned,
        coordinates: { lat: d.current_lat, lng: d.current_lng }
      };

      return {
        success: true,
        data: rider,
      };
    } catch {
      return { success: false, data: null };
    }
  }
};

function mapLocationToZone(lat: number, lng: number): string {
  // Simple check for common Hyderabad zones
  if (lat > 17.44 && lng < 78.40) return 'Madhapur / HITEC City';
  if (lat > 17.42 && lng < 78.42) return 'Jubilee Hills';
  if (lat < 17.42 && lng > 78.43) return 'Banjara Hills';
  return 'Hyderabad Core';
}
