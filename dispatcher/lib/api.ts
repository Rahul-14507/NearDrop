import type {
  BatchUploadResponse,
  DeliveryBatch,
  DeliveryListItem,
  DispatcherDriver,
  DispatcherHub,
  DispatcherStats,
  HubDropHistoryItem,
  RegisterHubRequest,
} from './types'

const PROXY_BASE = '/api/backend'

async function proxyFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    ...init,
    cache: 'no-store',
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error((err as { detail: string }).detail ?? 'Request failed')
  }
  return resp.json() as Promise<T>
}

// ─── Client-side typed helpers ─────────────────────────────────────────────

export function fetchStats(): Promise<DispatcherStats> {
  return proxyFetch('/dispatcher/stats')
}

export function fetchDrivers(): Promise<DispatcherDriver[]> {
  return proxyFetch('/dispatcher/drivers')
}

export function fetchBatches(): Promise<DeliveryBatch[]> {
  return proxyFetch('/dispatcher/batches')
}

export function fetchBatch(batchCode: string): Promise<BatchUploadResponse> {
  return proxyFetch(`/dispatcher/batch/${batchCode}`)
}

export function fetchDeliveries(): Promise<DeliveryListItem[]> {
  return proxyFetch('/dispatcher/deliveries')
}

export async function uploadBatch(
  file: File,
  driverId: number,
): Promise<BatchUploadResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('driver_id', String(driverId))
  return proxyFetch('/dispatcher/batch/upload', {
    method: 'POST',
    body: form,
  })
}

export function fetchHubs(): Promise<DispatcherHub[]> {
  return proxyFetch('/dispatcher/hubs')
}

export function fetchHubHistory(hubId: number): Promise<HubDropHistoryItem[]> {
  return proxyFetch(`/dispatcher/hubs/${hubId}/history`)
}

export function registerHub(data: RegisterHubRequest): Promise<DispatcherHub> {
  return proxyFetch('/dispatcher/hubs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateHub(
  hubId: number,
  data: Partial<RegisterHubRequest & { is_active: boolean }>,
): Promise<DispatcherHub> {
  return proxyFetch(`/dispatcher/hubs/${hubId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ─── Server-side fetch helper (used in server components) ─────────────────

export async function serverFetch<T>(path: string, token: string): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
  const resp = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error((err as { detail: string }).detail ?? 'Request failed')
  }
  return resp.json() as Promise<T>
}
