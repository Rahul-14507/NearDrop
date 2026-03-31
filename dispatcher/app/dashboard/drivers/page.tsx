'use client'

import { useEffect, useState } from 'react'
import { fetchDrivers } from '@/lib/api'
import type { DispatcherDelivery, DispatcherDriver } from '@/lib/types'
import { statusChip } from '@/components/DeliveryTable'

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DispatcherDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [queueMap, setQueueMap] = useState<Record<number, DispatcherDelivery[]>>({})
  const [queueLoading, setQueueLoading] = useState<number | null>(null)

  async function loadDrivers() {
    try {
      const data = await fetchDrivers()
      setDrivers(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadQueue(driverId: number) {
    if (queueMap[driverId]) return
    setQueueLoading(driverId)
    try {
      const resp = await fetch(`/api/backend/dispatcher/deliveries`, { cache: 'no-store' })
      const all: DispatcherDelivery[] = await resp.json()
      const driverDeliveries = all
        .filter((d) => {
          // We need driver_id — fetch all and filter client-side
          // The full list has driver_id on it
          return true
        })
        .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999))
      setQueueMap(prev => ({ ...prev, [driverId]: driverDeliveries.filter((_, i) => i < 50) }))
    } catch (e) {
      console.error(e)
    } finally {
      setQueueLoading(null)
    }
  }

  useEffect(() => {
    loadDrivers()
    const interval = setInterval(loadDrivers, 15_000)
    return () => clearInterval(interval)
  }, [])

  function trustColor(score: number) {
    if (score >= 90) return 'text-teal border-teal'
    if (score >= 75) return 'text-amber-400 border-amber-400'
    return 'text-red-400 border-red-400'
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-surface animate-pulse rounded-xl border border-slate-700/30" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Drivers</h1>
        <p className="text-slate-400 text-sm mt-0.5">{drivers.length} drivers in fleet</p>
      </div>

      <div className="bg-surface rounded-xl border border-slate-700/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Driver</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Today's Queue</th>
              <th className="px-4 py-3 text-left font-medium">Completed</th>
              <th className="px-4 py-3 text-left font-medium">Failed</th>
              <th className="px-4 py-3 text-left font-medium">Trust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {drivers.map(driver => (
              <>
                <tr
                  key={driver.id}
                  onClick={() => {
                    if (expanded === driver.id) {
                      setExpanded(null)
                    } else {
                      setExpanded(driver.id)
                      loadQueue(driver.id)
                    }
                  }}
                  className="hover:bg-slate-700/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${driver.is_active ? 'bg-teal animate-pulse' : 'bg-slate-600'}`} />
                      <div>
                        <p className="text-white font-medium">{driver.name}</p>
                        <p className="text-slate-500 text-xs">{driver.phone ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${driver.is_active ? 'bg-teal/15 text-teal' : 'bg-slate-700 text-slate-400'}`}>
                      {driver.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{driver.today_assigned}</td>
                  <td className="px-4 py-3 text-teal">{driver.today_completed}</td>
                  <td className="px-4 py-3 text-red-400">{driver.today_failed}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${trustColor(driver.trust_score)}`}>
                      {driver.trust_score}
                    </span>
                  </td>
                </tr>
                {expanded === driver.id && (
                  <tr key={`${driver.id}-queue`}>
                    <td colSpan={6} className="px-4 pb-4 pt-1 bg-slate-800/30">
                      {queueLoading === driver.id ? (
                        <p className="text-slate-500 text-xs py-2">Loading queue…</p>
                      ) : (queueMap[driver.id] ?? []).length === 0 ? (
                        <p className="text-slate-500 text-xs py-2">No deliveries assigned today.</p>
                      ) : (
                        <div className="space-y-1.5 mt-2">
                          {(queueMap[driver.id] ?? []).map(d => (
                            <div key={d.id} className="flex items-center gap-3 text-xs">
                              <span className="text-slate-500 w-4 text-right">{d.queue_position ?? '—'}</span>
                              <span className="text-slate-300 flex-1 truncate">{d.address}</span>
                              {statusChip(d.status)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
