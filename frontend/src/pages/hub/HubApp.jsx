import { useState, useEffect, useCallback } from 'react'
import { IndianRupee, Package, TrendingUp, LayoutDashboard, RefreshCw, CheckCircle2 } from 'lucide-react'
import { TrustBadge } from '../../components/ui/Badge'
import { ToastContainer, useToasts } from '../../components/ui/Toast'
import BroadcastCard from './BroadcastCard'
import { getHubStats, getActiveBroadcasts } from '../../api'
import { Link } from 'react-router-dom'

const HUB_ID = 1

export default function HubApp() {
  const [stats, setStats]         = useState(null)
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [polling, setPolling]     = useState(false)
  const { toasts, addToast, removeToast } = useToasts()

  const fetchStats = useCallback(async () => {
    try {
      const res = await getHubStats(HUB_ID)
      setStats(res.data)
    } catch {}
  }, [])

  const fetchBroadcasts = useCallback(async (silent = true) => {
    if (!silent) setPolling(true)
    try {
      const res = await getActiveBroadcasts(HUB_ID)
      const mapped = res.data.map(b => ({
        id: b.id, hub_id: HUB_ID,
        order_id: b.delivery.order_id,
        package_size: b.delivery.package_size,
        weight_kg: b.delivery.weight_kg,
        distance_m: b.distance_m,
        reward: b.reward,
      }))
      setBroadcasts(mapped)
    } catch {}
    finally { setPolling(false) }
  }, [])

  const initialFetch = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchBroadcasts()])
    setLoading(false)
  }, [fetchStats, fetchBroadcasts])

  useEffect(() => {
    initialFetch()
    const iv = setInterval(fetchBroadcasts, 8000)
    return () => clearInterval(iv)
  }, [initialFetch, fetchBroadcasts])

  const handleAccept = (broadcast) => {
    setBroadcasts(prev => prev.filter(b => b.id !== broadcast.id))
    setTimeout(fetchStats, 600)
    addToast(`Package #${broadcast.order_id} accepted! +₹${broadcast.reward}`, 'success')
  }

  const handleDecline = (broadcast) => {
    setBroadcasts(prev => prev.filter(b => b.id !== broadcast.id))
    addToast(`Package #${broadcast.order_id} declined`, 'info')
  }

  return (
    <div className="min-h-dvh" style={{ background: 'linear-gradient(160deg, #080f1e 0%, #060c18 60%, #04080f 100%)' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 280,
        background: 'radial-gradient(ellipse at 60% -10%, rgba(96,165,250,0.07) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div className="relative z-10 max-w-sm mx-auto min-h-dvh flex flex-col">

        {/* Header */}
        <header
          className="px-5 pt-6 pb-5"
          style={{
            background: 'linear-gradient(180deg, rgba(8,15,30,0.95) 0%, transparent 100%)',
          }}
        >
          {/* Top row: back + badge */}
          <div className="flex items-start justify-between mb-5">
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <LayoutDashboard className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </Link>

            <div className="flex items-center gap-2">
              {/* Polling indicator */}
              {polling && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: 'rgba(0,201,177,0.6)' }} />
              )}
              <TrustBadge score={stats?.trust_score ?? 0} />
            </div>
          </div>

          {/* Hub identity */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#60a5fa', boxShadow: '0 0 8px rgba(96,165,250,0.8)' }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(96,165,250,0.7)' }}>
                Hub Owner
              </span>
            </div>
            <h1 className="font-black text-white leading-tight" style={{ fontSize: 22 }}>
              {loading ? (
                <span className="inline-block h-6 w-44 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              ) : (stats?.name ?? 'Hub Dashboard')}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Hub Manager · Accepting packages</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                icon: IndianRupee, label: 'Earned Today',
                value: loading ? '—' : `₹${(stats?.today_earnings ?? 0).toFixed(0)}`,
                color: '#00c9b1', glow: 'rgba(0,201,177,0.12)',
              },
              {
                icon: CheckCircle2, label: 'Accepted',
                value: loading ? '—' : (stats?.accepted_count ?? 0),
                color: '#60a5fa', glow: 'rgba(96,165,250,0.12)',
              },
              {
                icon: Package, label: 'Pending',
                value: broadcasts.length,
                color: '#fbbf24', glow: 'rgba(251,191,36,0.12)',
                pulse: broadcasts.length > 0,
              },
            ].map(({ icon: Icon, label, value, color, glow, pulse }) => (
              <div
                key={label}
                className="flex flex-col items-center py-3 rounded-xl relative overflow-hidden"
                style={{ background: glow, border: `1px solid ${color}20` }}
              >
                {pulse && (
                  <div
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-ping"
                    style={{ background: color, opacity: 0.8, animationDuration: '1.5s' }}
                  />
                )}
                <Icon className="w-4 h-4 mb-1.5" style={{ color }} />
                <p className="text-base font-black text-white leading-none">{value}</p>
                <p className="text-[10px] mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
              </div>
            ))}
          </div>
        </header>

        {/* Broadcasts */}
        <div className="flex-1 px-5 pb-8 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: broadcasts.length ? '#00c9b1' : 'rgba(255,255,255,0.2)',
                  boxShadow: broadcasts.length ? '0 0 8px rgba(0,201,177,0.8)' : 'none',
                  animation: broadcasts.length ? 'pulse 2s infinite' : 'none',
                }}
              />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Incoming Requests
              </h2>
            </div>
            {broadcasts.length > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,201,177,0.1)', color: '#00c9b1', border: '1px solid rgba(0,201,177,0.2)' }}
              >
                {broadcasts.length} new
              </span>
            )}
          </div>

          {broadcasts.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}
            >
              <Package className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>No broadcasts right now</p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.18)' }}>Auto-refreshes every 8 seconds</p>
              <button
                onClick={() => fetchBroadcasts(false)}
                className="mt-4 text-sm font-bold"
                style={{ color: '#00c9b1' }}
              >
                Refresh now
              </button>
            </div>
          ) : (
            broadcasts.map(b => (
              <BroadcastCard
                key={b.id}
                broadcast={b}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            ))
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
