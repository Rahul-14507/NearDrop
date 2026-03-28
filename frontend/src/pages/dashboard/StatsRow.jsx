import { Package, CheckCircle, RefreshCw, Leaf } from 'lucide-react'

const ACCENT_CONFIGS = {
  deliveries: { icon: Package,     gradient: 'from-blue-500 to-indigo-600',  glow: 'rgba(99,102,241,0.25)',  label: 'Deliveries Today',      unit: null },
  success:    { icon: CheckCircle, gradient: 'from-teal-400 to-emerald-500', glow: 'rgba(0,201,177,0.25)',   label: '1st Attempt Success',   unit: '%'  },
  reroutes:   { icon: RefreshCw,   gradient: 'from-amber-400 to-orange-500', glow: 'rgba(251,191,36,0.25)',  label: 'Hub Reroutes',          unit: null },
  co2:        { icon: Leaf,        gradient: 'from-green-400 to-emerald-500', glow: 'rgba(52,211,153,0.25)', label: 'CO₂ Saved',             unit: 'kg' },
}

function StatCard({ configKey, value, change }) {
  const cfg = ACCENT_CONFIGS[configKey]
  const Icon = cfg.icon
  const positive = change >= 0

  return (
    <div className="stat-card relative overflow-hidden group cursor-default">
      {/* Ambient glow blob behind card */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none transition-all duration-500 group-hover:scale-125"
        style={{ background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)` }}
      />

      {/* Top row: icon + change badge */}
      <div className="flex items-start justify-between mb-4 relative">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${cfg.gradient} shrink-0`}
          style={{ boxShadow: `0 4px 16px ${cfg.glow}` }}
        >
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>

        {change !== undefined && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
            style={{
              background: positive ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${positive ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: positive ? '#34d399' : '#f87171',
            }}
          >
            {positive ? '↑' : '↓'} {Math.abs(change)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative">
        <p className="text-3xl font-black text-white leading-none tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {cfg.unit && <span className="text-base font-semibold text-white/30 ml-1.5">{cfg.unit}</span>}
        </p>
        <p className="text-xs font-medium mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {cfg.label}
        </p>
      </div>

      {/* Bottom accent line */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cfg.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />
    </div>
  )
}

export default function StatsRow({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard configKey="deliveries" value={stats.total_deliveries}             change={12}  />
      <StatCard configKey="success"    value={stats.first_attempt_success_rate}   change={3.2} />
      <StatCard configKey="reroutes"   value={stats.hub_reroutes}                 change={-5}  />
      <StatCard configKey="co2"        value={stats.co2_saved_kg}                 change={18}  />
    </div>
  )
}
