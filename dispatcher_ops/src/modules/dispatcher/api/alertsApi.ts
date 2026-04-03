import type { ApiResponse } from '../types/dispatcher.types';
import type { Alert } from '../store/alertStore';

/**
 * Mocking a REST backend for Alerts / Notification history
 */

export const AlertsApi = {
  getRecentAlerts: async (): Promise<ApiResponse<Alert[]>> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    // Simulate some recent backend alerts that the frontend might have missed
    const mockAlerts: Alert[] = [
      {
        id: 'alert-1',
        type: 'HUB_CAPACITY',
        message: 'Banjara Hills Hub is nearing max capacity (92%).',
        severity: 'warning',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        acknowledged: false,
        relatedEntityId: 'hub-banjara',
      },
      {
        id: 'alert-2',
        type: 'SLA_RISK',
        message: 'Delivery DEL-8812 is at risk of SLA breach in 4 mins.',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        acknowledged: false,
      }
    ];

    return {
      success: true,
      data: mockAlerts,
    };
  },
};
