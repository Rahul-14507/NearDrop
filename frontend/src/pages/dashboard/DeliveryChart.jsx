import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Activity } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(8,15,30,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 6 }}>
        {label}:00 – {label}:59
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize' }}>
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DeliveryChart({ data = [] }) {
  const isEmpty = data.length === 0
  const chartData = isEmpty
    ? Array.from({ length: 10 }, (_, i) => ({
        hour: i + 8,
        deliveries: Math.floor(Math.random() * 9) + 3,
        failures: Math.floor(Math.random() * 2),
      }))
    : data.map(d => ({ ...d, hour: `${d.hour}` }))

  const maxVal = Math.max(...chartData.map(d => d.deliveries + d.failures), 1)

  return (
    <div className="surface-md p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,201,177,0.1)' }}>
            <Activity className="w-4 h-4" style={{ color: '#00c9b1' }} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Hourly Activity</h3>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Deliveries vs failures by hour</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {[
            { color: '#00c9b1', label: 'Delivered' },
            { color: '#f87171', label: 'Failed' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={3} barCategoryGap="28%">
          <CartesianGrid
            strokeDasharray="0"
            horizontal={true}
            vertical={false}
            stroke="rgba(255,255,255,0.04)"
          />
          <XAxis
            dataKey="hour"
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 500 }}
            tickFormatter={v => `${v}h`}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }} />

          <Bar dataKey="deliveries" radius={[5, 5, 0, 0]} maxBarSize={20}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.deliveries / maxVal > 0.6 ? '#00c9b1' : '#00a892'}
                fillOpacity={0.9}
              />
            ))}
          </Bar>

          <Bar dataKey="failures" radius={[5, 5, 0, 0]} maxBarSize={20}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill="#ef4444"
                fillOpacity={entry.failures > 0 ? 0.75 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
