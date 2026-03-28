import { useState, useEffect, useCallback } from 'react'
import { FleetMap } from '../../components/maps/LeafletMap'
import Sidebar from './Sidebar'
import StatsRow from './StatsRow'
import DeliveryChart from './DeliveryChart'
import DriverLeaderboard from './DriverLeaderboard'
import { ToastContainer, useToasts } from '../../components/ui/Toast'
import { useWebSocket } from '../../hooks/useWebSocket'
import { getDashboardStats, getFleet, getHourlyMetrics, getLeaderboard } from '../../api'
import { RefreshCw, Wifi, WifiOff, Truck, Store, Map } from 'lucide-react'
import { Link } from 'react-router-dom'

const FALLBACK_FLEET = [
  { id: 1, name: 'Arjun Reddy',     lat: 17.4239, lng: 78.4738, status: 'en_route',  trust_score: 94 },
  { id: 2, name: 'Priya Sharma',    lat: 17.4456, lng: 78.3647, status: 'delivered', trust_score: 88 },
  { id: 3, name: 'Mohammed Farhan', lat: 17.4123, lng: 78.4501, status: 'failed',    trust_score: 79 },
  { id: 4, name: 'Sneha Patel',     lat: 17.4385, lng: 78.3892, status: 'arrived',   trust_score: 96 },
  { id: 5, name: 'Karthik Nair',    lat: 17.4501, lng: 78.4012, status: 'en_route',  trust_score: 71 },
]

const FALLBACK_STATS = {
  total_deliveries: 50, first_attempt_success_rate: 76.0,
  hub_reroutes: 8, co2_saved_kg: 6.4, active_drivers: 5,
}

const STATUS_LEGEND = [
  { color: '#00c9b1', label: 'Delivered' },
  { color: '#fbbf24', label: 'En Route'  },
  { color: '#60a5fa', label: 'Arrived'   },
  { color: '#f87171', label: 'Failed'    },
]

export default function DashboardApp() {
  const [stats, setStats]             = useState(null)
  const [fleet, setFleet]             = useState(FALLBACK_FLEET)
  const [hourly, setHourly]           = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [wsConnected, setWsConnected] = useState(false)
  const [lastUpdate, setLastUpdate]   = useState(new Date())
  const [refreshing, setRefreshing]   = useState(false)
  const { toasts, addToast, removeToast } = useToasts()

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const [s, f, h, l] = await Promise.allSettled([
        getDashboardStats(), getFleet(), getHourlyMetrics(), getLeaderboard(),
      ])
      if (s.status === 'fulfilled') setStats(s.value.data)
      else setStats(FALLBACK_STATS)
      if (f.status === 'fulfilled') setFleet(f.value.data)
      if (h.status === 'fulfilled') setHourly(h.value.data)
      if (l.status === 'fulfilled') setLeaderboard(l.value.data)
      setLastUpdate(new Date())
    } catch { setStats(FALLBACK_STATS) }
    finally { setTimeout(() => setRefreshing(false), 400) }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const handleWsMessage = useCallback((msg) => {
    setWsConnected(true)
    if (msg.type === 'delivery_failed') {
      addToast(`🔴 ${msg.data.driver_name}: Delivery failed — broadcasting to hubs`, 'error')
      fetchAll()
    }
  }, [addToast, fetchAll])
  useWebSocket(handleWsMessage)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060c18' }}>
      {/* Ambient backgrounds */}
      <div className="ambient-teal" />
      <div className="ambient-blue" />

      <Sidebar />

      <main className="flex-1 overflow-y-auto relative z-10">
        {/* Top bar */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-7 py-3.5"
          style={{
            background: 'rgba(6,12,24,0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <h1 className="font-black text-white leading-none" style={{ fontSize: 17, letterSpacing: '-0.01em' }}>
              Operations Dashboard
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Hyderabad Fleet ·{' '}
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                Updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* WS status pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{
                background: wsConnected ? 'rgba(0,201,177,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${wsConnected ? 'rgba(0,201,177,0.2)' : 'rgba(255,255,255,0.08)'}`,
                color: wsConnected ? '#00c9b1' : 'rgba(255,255,255,0.3)',
              }}
            >
              {wsConnected
                ? <><span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />Live</>
                : <><WifiOff className="w-3 h-3" />Offline</>
              }
            </div>

            <Link to="/driver" className="btn-ghost px-3 py-1.5 text-xs">
              <Truck className="w-3.5 h-3.5" /> Driver
            </Link>
            <Link to="/hub" className="btn-ghost px-3 py-1.5 text-xs">
              <Store className="w-3.5 h-3.5" /> Hub
            </Link>
            <button
              id="btn-refresh"
              onClick={fetchAll}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-7 py-6 space-y-5 max-w-screen-2xl">
          {/* Stats */}
          <StatsRow stats={stats} />

          {/* Fleet map — full width, taller */}
          <div className="surface-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.12)' }}>
                  <Map className="w-4 h-4" style={{ color: '#60a5fa' }} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Live Fleet Map</h3>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {fleet.length} vehicles tracked · Hyderabad
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4">
                {STATUS_LEGEND.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 380, borderRadius: 12, overflow: 'hidden' }}>
              <FleetMap drivers={fleet} height="380px" />
            </div>
          </div>

          {/* Chart + Leaderboard */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3">
              <DeliveryChart data={hourly} />
            </div>
            <div className="xl:col-span-2">
              <DriverLeaderboard data={leaderboard} />
            </div>
          </div>
        </div>
      </main>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
