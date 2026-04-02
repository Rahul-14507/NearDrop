'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchHubHistory, fetchHubs, registerHub, updateHub } from '@/lib/api'
import type { DispatcherHub, HubDropHistoryItem, HubType, RegisterHubRequest } from '@/lib/types'

// Hub type config
const HUB_CONFIG: Record<HubType | 'other', { emoji: string; label: string; color: string; bg: string; mapColor: string }> = {
  kirana: { emoji: '🏪', label: 'Kirana', color: 'text-teal', bg: 'bg-teal/10', mapColor: '#00B4A6' },
  pharmacy: { emoji: '💊', label: 'Pharmacy', color: 'text-blue-400', bg: 'bg-blue-400/10', mapColor: '#60A5FA' },
  apartment: { emoji: '🏢', label: 'Apartment', color: 'text-purple-400', bg: 'bg-purple-400/10', mapColor: '#C084FC' },
  other: { emoji: '📦', label: 'Other', color: 'text-slate-400', bg: 'bg-slate-700', mapColor: '#94A3B8' },
}

function getHubConfig(type: string) {
  return HUB_CONFIG[type as HubType] ?? HUB_CONFIG.other
}

// ─── Hub Card ────────────────────────────────────────────────────────────────

function HubCard({
  hub,
  selected,
  onSelect,
  onToggleActive,
  cardRef,
}: {
  hub: DispatcherHub
  selected: boolean
  onSelect: () => void
  onToggleActive: () => void
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const cfg = getHubConfig(hub.hub_type)

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={`mx-3 my-2 p-4 rounded-xl border cursor-pointer transition-all ${
        selected
          ? 'border-teal bg-teal/5'
          : 'border-slate-700/50 bg-surface hover:border-slate-600'
      } ${!hub.is_active ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl">{cfg.emoji}</span>
          <span className="text-white font-medium text-sm truncate">{hub.name}</span>
        </div>
        <span
          className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
            hub.is_active ? 'bg-teal/15 text-teal' : 'bg-slate-700 text-slate-400'
          }`}
        >
          {hub.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        <span className="text-slate-500 text-xs">Trust: {hub.trust_score}</span>
      </div>

      <div className="space-y-1 text-xs text-slate-400">
        <div>Today: {hub.today_drops} drops · ₹{hub.today_earnings_inr.toFixed(0)} earned</div>
        <div>Holding: {hub.current_packages_held} packages</div>
        {hub.owner_phone && <div>📞 {hub.owner_phone}</div>}
      </div>

      <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={onSelect}
          className="flex-1 text-xs py-1.5 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors"
        >
          View
        </button>
        <button
          onClick={onToggleActive}
          className="flex-1 text-xs py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition-colors"
        >
          {hub.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  )
}

// ─── Register Hub Modal ───────────────────────────────────────────────────────

function RegisterHubModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (hub: DispatcherHub) => void
}) {
  const [form, setForm] = useState<RegisterHubRequest>({
    name: '',
    address: '',
    hub_type: 'kirana',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.address) {
      setError('Name and address are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const hub = await registerHub(form)
      onSuccess(hub)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register hub')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl border border-slate-700/50 w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Register New Hub</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hub Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Sharma Kirana Store"
              className="w-full rounded-lg bg-navy border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Address *</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Full address for geocoding"
              className="w-full rounded-lg bg-navy border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hub Type</label>
            <select
              value={form.hub_type}
              onChange={e => setForm(f => ({ ...f, hub_type: e.target.value as HubType }))}
              className="w-full rounded-lg bg-navy border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-teal"
            >
              <option value="kirana">🏪 Kirana Store</option>
              <option value="pharmacy">💊 Pharmacy</option>
              <option value="apartment">🏢 Apartment Reception</option>
              <option value="other">📦 Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Owner Phone</label>
            <input
              type="tel"
              value={form.owner_phone ?? ''}
              onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg bg-navy border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-teal text-navy font-semibold text-sm hover:bg-teal/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Registering…' : 'Register Hub'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Hub Detail Panel ─────────────────────────────────────────────────────────

function HubDetailPanel({
  hub,
  onClose,
}: {
  hub: DispatcherHub
  onClose: () => void
}) {
  const [history, setHistory] = useState<HubDropHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const cfg = getHubConfig(hub.hub_type)

  useEffect(() => {
    fetchHubHistory(hub.id)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [hub.id])

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-surface border-l border-slate-700/50 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{cfg.emoji}</span>
            <div>
              <h2 className="text-white font-semibold">{hub.name}</h2>
              <p className="text-xs text-slate-400">{cfg.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 border-b border-slate-700/50 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Status</span>
            <span className={hub.is_active ? 'text-teal' : 'text-slate-400'}>
              {hub.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Trust Score</span>
            <span className="text-white">{hub.trust_score}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Today&apos;s drops</span>
            <span className="text-white">{hub.today_drops}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Today&apos;s earnings</span>
            <span className="text-white">₹{hub.today_earnings_inr.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total drops</span>
            <span className="text-white">{hub.total_drops_all_time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Packages held</span>
            <span className="text-white">{hub.current_packages_held}</span>
          </div>
          {hub.owner_phone && (
            <div className="flex justify-between">
              <span className="text-slate-400">Phone</span>
              <span className="text-white">{hub.owner_phone}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Recent Drops</h3>
          {loading ? (
            <div className="space-y-2">
              {Array(5).fill(null).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-700/30 animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-sm">No drop history yet</p>
          ) : (
            <div className="space-y-2">
              {history.map(item => (
                <div
                  key={item.delivery_id}
                  className="p-3 rounded-lg bg-navy/60 border border-slate-700/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{item.order_id}</p>
                      <p className="text-slate-400 text-xs truncate mt-0.5">{item.address}</p>
                    </div>
                    {item.pickup_code && (
                      <span className="ml-2 text-xs bg-teal/15 text-teal px-2 py-0.5 rounded font-mono">
                        {item.pickup_code}
                      </span>
                    )}
                  </div>
                  {item.accepted_at && (
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(item.accepted_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Azure Maps Component ─────────────────────────────────────────────────────

function HubsMap({
  hubs,
  selectedHubId,
  onHubSelect,
}: {
  hubs: DispatcherHub[]
  selectedHubId: number | null
  onHubSelect: (id: number) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<Map<number, unknown>>(new Map())
  const [mapError, setMapError] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!mapRef.current) return

    // Poll for atlas to become available (CDN loads asynchronously)
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      const atlasGlobal = (window as Record<string, unknown>)['atlas'] as Record<string, unknown> | undefined
      if (atlasGlobal) {
        clearInterval(poll)
        initMap(atlasGlobal)
      } else if (attempts > 10) {
        clearInterval(poll)
        setMapError(true)
      }
    }, 500)

    return () => clearInterval(poll)
  }, [])

  function initMap(atlas: Record<string, unknown>) {
    const mapsKey = process.env.NEXT_PUBLIC_AZURE_MAPS_KEY || ''
    if (!mapsKey || !mapRef.current) {
      setMapError(true)
      return
    }

    try {
      const MapClass = atlas['Map'] as new (container: HTMLElement, options: Record<string, unknown>) => unknown
      const map = new MapClass(mapRef.current, {
        center: [78.4738, 17.4239], // Hyderabad
        zoom: 11,
        authOptions: {
          authType: 'subscriptionKey',
          subscriptionKey: mapsKey,
        },
        style: 'night',
      })
      mapInstanceRef.current = map
      setMapReady(true)
    } catch (e) {
      console.error('Azure Maps init error:', e)
      setMapError(true)
    }
  }

  // Add/update markers when hubs change and map is ready
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    const atlas = (window as Record<string, unknown>)['atlas'] as Record<string, unknown> | undefined
    if (!atlas) return

    try {
      const map = mapInstanceRef.current as Record<string, unknown>
      const markers = map['markers'] as Record<string, unknown>

      // Clear existing markers
      markersRef.current.forEach(marker => {
        markers['remove'](marker)
      })
      markersRef.current.clear()

      // Add hub markers
      hubs.forEach(hub => {
        const cfg = getHubConfig(hub.hub_type)
        const HtmlMarkerClass = atlas['HtmlMarker'] as new (options: Record<string, unknown>) => unknown
        const marker = new HtmlMarkerClass({
          position: [hub.lng, hub.lat],
          color: cfg.mapColor,
          text: cfg.emoji,
          popup: {
            content: `<div style="padding:8px;background:#162032;color:white;border-radius:8px;font-size:12px">
              <strong>${hub.name}</strong><br/>
              Today: ${hub.today_drops} drops<br/>
              Holding: ${hub.current_packages_held} packages
            </div>`,
            pixelOffset: [0, -18],
          },
        })

        ;(map['events'] as Record<string, unknown>)['add']('click', marker, () => {
          onHubSelect(hub.id)
        })

        markers['add'](marker)
        markersRef.current.set(hub.id, marker)
      })
    } catch (e) {
      console.error('Marker error:', e)
    }
  }, [hubs, mapReady, onHubSelect])

  if (mapError) {
    // Fallback table view
    return (
      <div className="w-full h-full overflow-auto p-4">
        <p className="text-slate-400 text-sm mb-4">Map unavailable — showing hub list</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase">
              <th className="text-left py-2">Hub</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Lat</th>
              <th className="text-left py-2">Lng</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {hubs.map(hub => (
              <tr key={hub.id} className="border-t border-slate-700/50">
                <td className="py-2 text-white">{hub.name}</td>
                <td className="py-2 text-slate-400">{hub.hub_type}</td>
                <td className="py-2 text-slate-400">{hub.lat.toFixed(4)}</td>
                <td className="py-2 text-slate-400">{hub.lng.toFixed(4)}</td>
                <td className="py-2">
                  <span className={`text-xs ${hub.is_active ? 'text-teal' : 'text-slate-500'}`}>
                    {hub.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return <div ref={mapRef} className="w-full h-full" />
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HubsPage() {
  const [hubs, setHubs] = useState<DispatcherHub[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHubId, setSelectedHubId] = useState<number | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const loadHubs = useCallback(async () => {
    try {
      const data = await fetchHubs()
      setHubs(data)
    } catch (e) {
      console.error('Failed to load hubs:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHubs()
  }, [loadHubs])

  const selectedHub = hubs.find(h => h.id === selectedHubId) ?? null

  function handleHubSelect(id: number) {
    setSelectedHubId(prev => prev === id ? null : id)
    // Scroll card into view
    const card = cardRefs.current.get(id)
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function handleToggleActive(hub: DispatcherHub) {
    try {
      const updated = await updateHub(hub.id, { is_active: !hub.is_active })
      setHubs(prev => prev.map(h => h.id === hub.id ? updated : h))
    } catch (e) {
      console.error('Failed to update hub:', e)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Hub Network</h1>
          <p className="text-slate-400 text-sm mt-0.5">{hubs.length} hubs registered</p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal text-navy font-semibold text-sm hover:bg-teal/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Register Hub
        </button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-[420px] flex-shrink-0 border-r border-slate-700/50 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array(4).fill(null).map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-slate-700/30 animate-pulse" />
              ))}
            </div>
          ) : hubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-slate-400 text-sm">No hubs registered yet.</p>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="mt-4 text-teal text-sm hover:underline"
              >
                Register your first hub
              </button>
            </div>
          ) : (
            hubs.map(hub => (
              <HubCard
                key={hub.id}
                hub={hub}
                selected={selectedHubId === hub.id}
                onSelect={() => handleHubSelect(hub.id)}
                onToggleActive={() => handleToggleActive(hub)}
                cardRef={el => {
                  if (el) cardRefs.current.set(hub.id, el)
                  else cardRefs.current.delete(hub.id)
                }}
              />
            ))
          )}
        </div>

        {/* Right: Azure Maps */}
        <div className="flex-1 relative bg-navy/50">
          <HubsMap
            hubs={hubs}
            selectedHubId={selectedHubId}
            onHubSelect={handleHubSelect}
          />
        </div>
      </div>

      {/* Modals / panels */}
      {showRegisterModal && (
        <RegisterHubModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={hub => {
            setHubs(prev => [...prev, hub])
            setShowRegisterModal(false)
          }}
        />
      )}
      {selectedHub && (
        <HubDetailPanel
          hub={selectedHub}
          onClose={() => setSelectedHubId(null)}
        />
      )}
    </div>
  )
}
