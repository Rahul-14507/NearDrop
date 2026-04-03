// ─── Enums & State Machines ──────────────────────────────────────────────────

export type IncidentStatus = 'NEW' | 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'FAILED' | 'ESCALATED';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiderStatus = 'online' | 'offline' | 'idle' | 'on-delivery';

export type HubRiskLevel = 'Safe' | 'Warning' | 'Critical';

export type ActionType = 'AUTO_ASSIGN' | 'MANUAL_OVERRIDE' | 'ESCALATE' | 'RESOLVE' | 'ALERT_ACKNOWLEDGED';

// ─── Core Entities ───────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Incident {
  id: string; // V1 back-compat
  incidentId?: string; // V2 alias
  deliveryId: string;
  driverId: string;
  location: string;
  coordinates: Coordinates;        // Failed delivery point
  driverCoordinates?: Coordinates; // Driver's current position (en route)
  timestamp: string;
  status: IncidentStatus;
  severity?: IncidentSeverity;
  failureReason?: string;
  assignedRiderId?: string;
  recommendedRiderId?: string;
  slaDeadline?: string; // ISO Timestamp or ISO String for SLA breaches
}

export interface Rider {
  id: string;
  name?: string;
  zone: string;
  score: number; // Delivery/Trust Score (0-100)
  status: RiderStatus;
  load: number;
  currentTask?: string;
  etaToHub?: number; // In minutes
  lastActiveTimestamp?: string;
  idleSince?: string;
  onDeliverySince?: string;
  coordinates?: Coordinates;
}

export interface Hub {
  id: string;
  zone: string;
  activeLoad: number;
  maxCapacity: number;
  availableSlots: number;
  riskLevel: HubRiskLevel;
  coordinates: Coordinates;
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export interface DispatchActionLog {
  id: string;
  dispatcherId: string;
  incidentId: string;
  action: ActionType;
  previousAssignee?: string;
  newAssignee?: string;
  timestamp: string;
  details?: string;
}

// ─── KPI Dashboard ───────────────────────────────────────────────────────────

export type KPITrend = 'up' | 'down' | 'neutral';

export interface KPIStat {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  trend: KPITrend;
  trendValue?: string;
  icon: string;
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export type MarkerType = 'driver' | 'failed_delivery' | 'hub';

export interface MapMarker {
  id: string;
  type: MarkerType;
  label: string;
  coordinates: Coordinates;
  description?: string;
  deliveryId?: string;
  status?: string;
  assignedHubId?: string;
}

// ─── API Service Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface UpdateIncidentPayload {
  incidentId: string;
  status: IncidentStatus;
}

// ─── WebSocket Types ─────────────────────────────────────────────────────────

export type SocketEventType = 
  | 'NEW_INCIDENT' 
  | 'RIDER_AVAILABLE' 
  | 'RIDER_UNAVAILABLE' 
  | 'SCORE_UPDATED' 
  | 'INCIDENT_ESCALATED' 
  | 'SLA_BREACH' 
  | 'DELIVERY_REASSIGNED'
  | 'HUB_OVERLOAD'
  // Back-compat:
  | 'incident_created' 
  | 'incident_updated' 
  | 'driver_location_update';

export interface SocketEvent<T = unknown> {
  type: SocketEventType;
  payload: T;
  timestamp: string;
}
