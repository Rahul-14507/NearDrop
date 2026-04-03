import type { DispatchActionLog, ActionType } from '../types/dispatcher.types';

export class AuditLogger {
  private static logs: DispatchActionLog[] = [];

  public static logAction(
    actionType: ActionType,
    dispatcherId: string,
    incidentId: string,
    details?: string
  ): void {
    const log: DispatchActionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      action: actionType,
      dispatcherId,
      incidentId,
      timestamp: new Date().toISOString(),
      details,
    };
    
    this.logs.push(log);
    
    // In V2, we would also flush these to a backend endpoint like `/api/v1/audit`
    // e.g. await axios.post('/api/v1/audit', log);
    console.info(`[AuditLogger] Action Recorded: ${actionType} on ${incidentId} by ${dispatcherId}`, details ? `- ${details}` : '');
  }

  public static getLogs(): DispatchActionLog[] {
    return [...this.logs];
  }
}
