import type { Incident } from '../types/dispatcher.types';

export interface SLAStatus {
  timeRemainingSeconds: number;
  isBreached: boolean;
  breachedBySeconds: number;
  severity: 'normal' | 'warning' | 'critical' | 'breached';
  formattedTime: string;
}

/**
 * SLA Countdown & Risk Engine
 * ---------------------------
 * Monitors active incidents against their backend-provided SLA deadlines.
 * Translates timestamps into real-time UI states.
 */
export class SLAEngine {
  
  public static evaluateSLA(incident: Incident): SLAStatus {
    const defaultSLA = 1800; // 30 minutes in seconds

    // If backend doesn't provide an SLA, we extrapolate from incident creation timestamp
    const deadlineMs = incident.slaDeadline 
      ? new Date(incident.slaDeadline).getTime()
      : new Date(incident.timestamp).getTime() + (defaultSLA * 1000);

    const nowMs = Date.now();
    const diffSeconds = Math.round((deadlineMs - nowMs) / 1000);

    const isBreached = diffSeconds <= 0;
    const absSeconds = Math.abs(diffSeconds);

    const minutes = Math.floor(absSeconds / 60);
    const seconds = absSeconds % 60;
    const formattedTime = `${isBreached ? '-' : ''}${minutes}m ${seconds}s`; // e.g., "8m 24s" or "-2m 10s"

    let severity: SLAStatus['severity'] = 'normal';
    if (isBreached) {
      severity = 'breached';
    } else if (diffSeconds < 300) { // < 5 mins
      severity = 'critical';
    } else if (diffSeconds < 900) { // < 15 mins
      severity = 'warning';
    }

    // Incidents that are resolved stop counting down
    if (incident.status === 'RESOLVED' || incident.status === 'FAILED') {
      return {
        timeRemainingSeconds: 0,
        isBreached: false,
        breachedBySeconds: 0,
        severity: 'normal',
        formattedTime: '0m 0s',
      };
    }

    return {
      timeRemainingSeconds: isBreached ? 0 : diffSeconds,
      isBreached,
      breachedBySeconds: isBreached ? absSeconds : 0,
      severity,
      formattedTime,
    };
  }

}
