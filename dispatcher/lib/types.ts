// ─── Driver ──────────────────────────────────────────────────────────────────

export interface DispatcherDriver {
  id: number
  name: string
  phone: string | null
  is_active: boolean
  current_lat: number
  current_lng: number
  today_assigned: number
  today_completed: number
  today_failed: number
  trust_score: number
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'en_route'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'hub_delivered'

export interface DispatcherDelivery {
  id: number
  order_id: string
  address: string
  status: DeliveryStatus
  recipient_name: string | null
  customer_email: string | null
  customer_phone: string | null
  package_size: string
  weight_kg: number
  queue_position: number | null
  created_at: string
  hub_otp_verified: boolean | null
  hub_otp_sent_at: string | null
}

export interface DeliveryListItem {
  id: number
  order_id: string
  address: string
  status: DeliveryStatus
  recipient_name: string | null
  driver_name: string | null
  driver_id: number | null
  batch_code: string | null
  queue_position: number | null
  customer_email: string | null
  customer_phone: string | null
  hub_otp_verified: boolean | null
  hub_otp_sent_at: string | null
  created_at: string
}

// ─── Batch ────────────────────────────────────────────────────────────────────

export interface DeliveryBatch {
  id: number
  batch_code: string
  driver_id: number
  driver_name: string
  dispatcher_id: number
  assigned_at: string
  total_deliveries: number
  status: 'active' | 'completed' | 'accepted' | 'rejected'
  delivered_count: number
  failed_count: number
  pending_count: number
}

export interface BatchUploadResponse {
  batch_code: string
  driver_id: number
  driver_name: string
  total_deliveries: number
  deliveries: DispatcherDelivery[]
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface DispatcherStats {
  active_drivers: number
  total_assigned_today: number
  delivered_today: number
  failed_today: number
  hub_rerouted_today: number
  pending_today: number
  success_rate_percent: number
  co2_saved_kg: number
  active_hubs: number
}

// ─── Hub ─────────────────────────────────────────────────────────────────────

export type HubType = 'kirana' | 'pharmacy' | 'apartment' | 'other'

export interface DispatcherHub {
  id: number
  name: string
  lat: number
  lng: number
  hub_type: HubType
  is_active: boolean
  trust_score: number
  total_drops_all_time: number
  today_drops: number
  today_earnings_inr: number
  current_packages_held: number
  owner_phone: string | null
}

export interface RegisterHubRequest {
  name: string
  address: string
  lat?: number
  lng?: number
  hub_type: HubType
  owner_phone?: string
}

export interface HubDropHistoryItem {
  delivery_id: number
  order_id: string
  address: string
  accepted_at: string | null
  pickup_code: string | null
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string
  token_type: string
  user_id: number
  role: string
  name: string
  dispatcher_id: number
}

// ─── CSV row (client-side parsed) ────────────────────────────────────────────

export interface CsvRow {
  delivery_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  delivery_address: string
  _errors?: string[]
}
