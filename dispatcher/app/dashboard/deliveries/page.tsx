'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchDeliveries, fetchDrivers } from '@/lib/api'
import type { DeliveryListItem, DeliveryStatus, DispatcherDriver } from '@/lib/types'
import DeliveryTable from '@/components/DeliveryTable'

const STATUS_OPTIONS: Array<{ value: DeliveryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'en_route', label: 'En Route' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'hub_delivered', label: 'Hub Delivered' },
]

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([])
  const [drivers, setDrivers] = useState<DispatcherDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all')
  const [driverFilter, setDriverFilter] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryListItem | null>(null)

  async function loadData() {
    try {
      const [dels, drvs] = await Promise.all([fetchDeliveries(), fetchDrivers()])
      setDeliveries(dels)
      setDrivers(drvs)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    return deliveries.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (driverFilter !== 'all' && d.driver_id !== driverFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!d.order_id.toLowerCase().includes(q) && !(d.recipient_name ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [deliveries, statusFilter, driverFilter, search])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">All Deliveries</h1>
        <p className="text-slate-400 text-sm mt-0.5">{filtered.length} of {deliveries.length} deliveries (last 7 days)</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by ID or customer name…"
          className="flex-1 min-w-48 rounded-lg bg-surface border border-slate-700 px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DeliveryStatus | 'all')}
          className="rounded-lg bg-surface border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-teal"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={driverFilter === 'all' ? 'all' : String(driverFilter)}
          onChange={e => setDriverFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-lg bg-surface border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-teal"
        >
          <option value="all">All Drivers</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <DeliveryTable
        deliveries={filtered}
        loading={loading}
        onSelect={setSelectedDelivery}
      />

      {/* Detail modal */}
      {selectedDelivery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedDelivery(null)}
        >
          <div
            className="bg-surface rounded-2xl border border-slate-700/50 w-full max-w-lg p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold">{selectedDelivery.order_id}</h2>
                <p className="text-slate-400 text-xs mt-0.5">Delivery detail</p>
              </div>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <Row label="Address" value={selectedDelivery.address} />
              <Row label="Customer" value={selectedDelivery.recipient_name ?? '—'} />
              <Row label="Email" value={selectedDelivery.customer_email ?? '—'} />
              <Row label="Phone" value={selectedDelivery.customer_phone ?? '—'} />
              <Row label="Driver" value={selectedDelivery.driver_name ?? '—'} />
              <Row label="Batch" value={selectedDelivery.batch_code ?? 'Standalone'} />
              <Row label="Queue position" value={selectedDelivery.queue_position != null ? String(selectedDelivery.queue_position) : '—'} />
              <Row label="OTP verified" value={selectedDelivery.hub_otp_verified ? 'Yes' : 'No'} />
              {selectedDelivery.hub_otp_sent_at && (
                <Row label="OTP sent at" value={new Date(selectedDelivery.hub_otp_sent_at).toLocaleString()} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-200 flex-1 break-words">{value}</span>
    </div>
  )
}
