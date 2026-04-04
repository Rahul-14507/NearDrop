import { fetchWithAuth } from './apiClient';
import type { Rider, ApiResponse } from '../types/dispatcher.types';

export const RidersApi = {
  getRealtimeFleet: async (city?: string): Promise<ApiResponse<Rider[]>> => {
    try {
      // Append city query param
      const queryParam = city && city !== 'All Cities' ? `?city=${encodeURIComponent(city)}` : '';
      const response = await fetchWithAuth(`/api/dispatcher/drivers${queryParam}`);
      if (!response.ok) throw new Error('Failed to fetch drivers');
      const data = await response.json();
      
      const riders: Rider[] = data.map((d: any) => ({
        id: String(d.id),
        name: d.name,
        zone: mapLocationToZone(d.current_lat, d.current_lng, d.city || 'Hyderabad'),
        city: d.city || 'Hyderabad', // Default fallback for mocked
        score: d.trust_score,
        band: d.band,
        status: d.is_active ? 'online' : 'offline',
        load: d.today_assigned,
        etaToHub: 10, // Simulated
        lastActiveTimestamp: new Date().toISOString(),
        coordinates: { lat: d.current_lat, lng: d.current_lng }
      }));

      // Map mock fallback
      let filteredRiders = riders;
      if (city && city !== 'All Cities') {
        filteredRiders = filteredRiders.filter(r => r.city.toLowerCase() === city.toLowerCase());
      }

      return {
        success: true,
        data: filteredRiders,
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
        zone: mapLocationToZone(d.current_lat, d.current_lng, d.city || 'Hyderabad'),
        city: d.city || 'Hyderabad', // Default fallback
        score: d.trust_score,
        band: d.band,
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

function mapLocationToZone(lat: number, lng: number, city: string): string {
  if (city === 'Hyderabad') {
    if (lat > 17.44 && lng < 78.40) return 'Madhapur / HITEC City';
    if (lat > 17.42 && lng < 78.42) return 'Jubilee Hills';
    if (lat < 17.42 && lng > 78.43) return 'Banjara Hills';
    return 'Hyderabad Core';
  }
  if (city === 'Mumbai') {
    if (lat > 19.05) return 'Bandra / Andheri';
    return 'South Mumbai';
  }
  if (city === 'Delhi') {
    if (lat > 28.6) return 'North/Central Delhi';
    return 'South/Dwarka';
  }
  if (city === 'Bengaluru') {
    if (lng > 77.6) return 'Indiranagar / Whitefield';
    return 'Koramangala / Central';
  }
  if (city === 'Chennai') {
    if (lat < 13.0) return 'Adyar / OMR';
    return 'Anna Nagar / Central';
  }
  if (city === 'Kolkata') {
    if (lng > 88.4) return 'Salt Lake / New Town';
    return 'Park Street / South';
  }
  return `${city} Core`;
}
