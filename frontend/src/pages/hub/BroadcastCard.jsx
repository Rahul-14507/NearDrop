import { useState } from 'react'
import { Package, MapPin, CheckCircle, Clock, Weight } from 'lucide-react'
import { acceptBroadcast } from '../../api'

const SIZE_CONFIG = {
  small:  { label: 'Small',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  large:  { label: 'Large',  color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
}

export default function BroadcastCard({ broadcast, onAccept, onDecline }) {
  const [state, setState] = useState('idle')
  const [pickupCode, setPickupCode] = useState('')
  const sizeCfg = SIZE_CONFIG[broadcast.package_size] ?? SIZE_CONFIG.medium

  const handleAccept = async () => {
    setState('accepting')
    try {
      const res = await acceptBroadcast(broadcast.id, broadcast.hub_id)
      setPickupCode(res.data.pickup_code)
      setState('accepted')
      onAccept?.(broadcast, res.data.pickup_code)
    } catch {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      setPickupCode(code)
      setState('accepted')
      onAccept?.(broadcast, code)
    }
  }

  const handleDecline = () => {
    setState('declined')
    onDecline?.(broadcast)
  }

  if (state === 'declined') return null

  if (state === 'accepted') {
    return (
      <div
        className="animate-bounce-in rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(0,201,177,0.08) 0%, rgba(0,201,177,0.03) 100%)',
          border: '1px solid rgba(0,201,177,0.25)',
          boxShadow: '0 8px 40px rgba(0,201,177,0.1)',
        }}
      >
        {/* Top accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #00c9b1, #34d399)' }} />

        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,201,177,0.15)', border: '1px solid rgba(0,201,177,0.3)' }}
            >
              <CheckCircle className="w-5 h-5" style={{ color: '#00c9b1' }} />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Package Accepted</p>
              <p className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>#{broadcast.order_id}</p>
            </div>
          </div>

          {/* Code display */}
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Pickup Code — Show to Driver
            </p>
            <p
              className="font-black tracking-[0.35em] leading-none"
              style={{ fontSize: 28, color: '#00c9b1', textShadow: '0 0 20px rgba(0,201,177,0.5)' }}
            >
              {pickupCode}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="broadcast-card animate-slide-up"
    >
      {/* Top urgency bar */}
      <div
        style={{
          height: 2,
          background: 'linear-gradient(90deg, #fbbf24, #00c9b1)',
          animation: 'shimmer 2s linear infinite',
        }}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#fbbf24' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(251,191,36,0.7)' }}>
                New Request
              </p>
            </div>
            <p className="font-black text-white text-sm">Incoming Package</p>
          </div>
          <span
            className="font-mono text-[11px] px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            #{broadcast.order_id}
          </span>
        </div>

        {/* Metadata pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <MapPin className="w-3 h-3" style={{ color: '#60a5fa' }} />
            {broadcast.distance_m < 1000
              ? `${Math.round(broadcast.distance_m)}m`
              : `${(broadcast.distance_m / 1000).toFixed(1)}km`}
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: sizeCfg.bg, color: sizeCfg.color, border: `1px solid ${sizeCfg.color}25` }}
          >
            <Package className="w-3 h-3" />
            {sizeCfg.label}
          </div>

          {broadcast.weight_kg && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Weight className="w-3 h-3" />
              {broadcast.weight_kg}kg
            </div>
          )}
        </div>

        {/* Reward strip */}
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2.5 mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(0,201,177,0.08) 0%, rgba(52,211,153,0.05) 100%)',
            border: '1px solid rgba(0,201,177,0.15)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Storage reward</span>
          </div>
          <span className="text-base font-black" style={{ color: '#00c9b1' }}>
            +₹{broadcast.reward ?? 25}
          </span>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-2">
          <button
            id={`btn-accept-${broadcast.id}`}
            onClick={handleAccept}
            disabled={state === 'accepting'}
            className="btn-primary flex-1 text-sm"
          >
            {state === 'accepting'
              ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : '✓ Accept Package'
            }
          </button>
          <button
            id={`btn-decline-${broadcast.id}`}
            onClick={handleDecline}
            className="btn-danger px-4"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
