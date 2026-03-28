import { TrendingUp, TrendingDown, Minus, Crown } from 'lucide-react'
import clsx from 'clsx'

const FALLBACK = [
  { rank: 1, driver_id: 4, name: 'Sneha Patel',     deliveries_completed: 14, trust_score: 96, trend: 'up'     },
  { rank: 2, driver_id: 1, name: 'Arjun Reddy',     deliveries_completed: 11, trust_score: 94, trend: 'up'     },
  { rank: 3, driver_id: 2, name: 'Priya Sharma',    deliveries_completed: 9,  trust_score: 88, trend: 'stable' },
  { rank: 4, driver_id: 3, name: 'Mohammed Farhan', deliveries_completed: 6,  trust_score: 79, trend: 'stable' },
  { rank: 5, driver_id: 5, name: 'Karthik Nair',    deliveries_completed: 4,  trust_score: 71, trend: 'down'   },
]

const RANK_STYLES = {
  1: { medal: '🥇', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
  2: { medal: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
  3: { medal: '🥉', color: '#cd7f32', bg: 'rgba(205,127,50,0.08)', border: 'rgba(205,127,50,0.15)' },
}

function TrendBadge({ trend }) {
  if (trend === 'up')   return <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>↑</span>
  if (trend === 'down') return <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>↓</span>
  return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>—</span>
}

function ScoreBar({ score }) {
  const color =
    score >= 90 ? 'linear-gradient(90deg, #00c9b1, #34d399)' :
    score >= 75 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                  'linear-gradient(90deg, #ef4444, #f97316)'

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold w-5 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>{score}</span>
    </div>
  )
}

export default function DriverLeaderboard({ data }) {
  const entries = data?.length ? data : FALLBACK

  return (
    <div className="surface-md p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4" style={{ color: '#fbbf24' }} />
            <h3 className="font-bold text-white text-sm">Driver Leaderboard</h3>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Today's performance ranking</p>
        </div>
        <div className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(0,201,177,0.08)', color: 'rgba(0,201,177,0.7)', border: '1px solid rgba(0,201,177,0.15)' }}>
          Live
        </div>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const rs = RANK_STYLES[entry.rank]
          return (
            <div
              key={entry.driver_id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-default"
              style={{
                background: rs ? rs.bg : 'transparent',
                border: rs ? `1px solid ${rs.border}` : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!rs) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!rs) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Rank */}
              <div className="w-6 text-center shrink-0">
                {rs
                  ? <span style={{ fontSize: 16 }}>{rs.medal}</span>
                  : <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>{entry.rank}</span>
                }
              </div>

              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                style={{
                  background: rs
                    ? `radial-gradient(circle at 30% 30%, ${rs.color}40, ${rs.color}15)`
                    : 'rgba(255,255,255,0.06)',
                  border: rs ? `1px solid ${rs.color}30` : '1px solid rgba(255,255,255,0.08)',
                  color: rs ? rs.color : 'rgba(255,255,255,0.5)',
                }}
              >
                {entry.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-white/80 truncate pr-2">{entry.name}</p>
                  <span className="text-xs font-black shrink-0" style={{ color: '#00c9b1' }}>
                    {entry.deliveries_completed}
                  </span>
                </div>
                <ScoreBar score={entry.trust_score} />
              </div>

              {/* Trend */}
              <TrendBadge trend={entry.trend} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
