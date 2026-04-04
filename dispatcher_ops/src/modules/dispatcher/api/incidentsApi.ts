import type { Incident, ApiResponse, IncidentStatus } from '../types/dispatcher.types';
import { fetchWithAuth } from './apiClient';

export const IncidentsApi = {
  // Fetch the active queue from the backend
  getActiveIncidents: async (city?: string): Promise<ApiResponse<Incident[]>> => {
    try {
      // Append city query param if selected city is not 'All Cities'
      const queryParam = city && city !== 'All Cities' ? `?city=${encodeURIComponent(city)}` : '';
      const response = await fetchWithAuth(`/api/dispatcher/deliveries${queryParam}`);
      if (!response.ok) throw new Error('Failed to fetch incidents');
      
      const data = await response.json();
      
      // Map backend DispatcherDeliveryListOut to frontend Incident
      const incidents: Incident[] = data.map((d: any) => ({
        id: String(d.id),
        deliveryId: d.order_id,
        driverId: String(d.driver_id),
        location: d.address,
        city: d.city || 'Hyderabad', // Default fallback for now
        coordinates: { lat: d.lat || 17.43, lng: d.lng || 78.44 },
        timestamp: d.created_at,
        status: mapStatus(d.status),
        failureReason: d.failure_reason || 'Delivery failed',
        severity: 'high',
        slaDeadline: new Date(new Date(d.created_at).getTime() + 1800000).toISOString()
      }));

      // Fallback client-side filtering in case backend ignores the ?city param
      let filteredIncidents = incidents.filter(inc => inc.status !== 'RESOLVED' && inc.status !== 'FAILED');
      if (city && city !== 'All Cities') {
        filteredIncidents = filteredIncidents.filter(inc => inc.city.toLowerCase() === city.toLowerCase());
      }

      return {
        success: true,
        data: filteredIncidents,
      };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  },

  // Manual or Auto Assignment endpoint
  assignIncident: async (incidentId: string, riderId: string): Promise<ApiResponse<Incident>> => {
    try {
      const response = await fetchWithAuth(`/api/dispatcher/deliveries/${incidentId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ driver_id: parseInt(riderId) }),
      });
      if (!response.ok) throw new Error('Assignment failed');
      const data = await response.json();
      return { success: true, data: data as Incident };
    } catch (error: any) {
      return { success: false, data: {} as Incident, message: error.message };
    }
  },

  // Resolve or Escalate endpoint
  updateIncidentStatus: async (incidentId: string, status: IncidentStatus): Promise<ApiResponse<Incident>> => {
    try {
      const response = await fetchWithAuth(`/api/dispatcher/deliveries/${incidentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: status.toLowerCase() }),
      });
      if (!response.ok) throw new Error('Status update failed');
      const data = await response.json();
      return { success: true, data: data as Incident };
    } catch (error: any) {
      return { success: false, data: {} as Incident, message: error.message };
    }
  }
};

// Internal status mapping
function mapStatus(backendStatus: string): IncidentStatus {
  switch (backendStatus.toLowerCase()) {
    case 'failed': return 'PENDING';
    case 'en_route': return 'IN_PROGRESS';
    case 'delivered': return 'RESOLVED';
    case 'hub_delivered': return 'RESOLVED';
    default: return 'NEW';
  }
}
