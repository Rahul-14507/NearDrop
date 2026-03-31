'use client'

import { useEffect, useState } from 'react'
import { fetchStats } from '@/lib/api'
import type { DispatcherStats } from '@/lib/types'

function rateColor(rate: number): string {
  if (rate >= 75) return 'text-teal'
  if (rate >= 50) return 'text-amber-400'
  return 'text-red-400'
}

export default function StatsBar() {
  const [stats, setStats] = useState<DispatcherStats | null>(null)

  async function load() {
    try {
      const data = await fetchStats()
      setStats(data)
    } catch (e) {
      console.error('StatsBar fetch error:', e)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  const cards = stats
    ? [
        {
          label: 'Active Drivers',
          value: <span className="text-teal text-3xl font-bold">{stats.active_drivers}</span>,
          sub: `of fleet`,
        },
        {
          label: 'Deliveries Today',
          value: (
            <span className="text-white text-3xl font-bold">
              {stats.delivered_today}
              <span className="text-slate-500 text-lg font-normal">/{stats.total_assigned_today}</span>
            </span>
          ),
          sub: `${stats.pending_today} pending`,
        },
        {
          label: 'Success Rate',
          value: (
            <span className={`text-3xl font-bold ${rateColor(stats.success_rate_percent)}`}>
              {stats.success_rate_percent.toFixed(1)}%
            </span>
          ),
          sub: `${stats.failed_today} failed · ${stats.hub_rerouted_today} rerouted`,
        },
        {
          label: 'CO₂ Saved',
          value: (
            <span className="text-teal text-3xl font-bold">
              {stats.co2_saved_kg.toFixed(1)}
              <span className="text-lg font-normal text-slate-400"> kg</span>
            </span>
          ),
          sub: '🌿 from hub reroutes',
        },
      ]
    : Array(4).fill(null)

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) =>
        card === null ? (
          <div key={i} className="bg-surface rounded-xl border border-slate-700/30 p-5 animate-pulse h-24" />
        ) : (
          <div key={i} className="bg-surface rounded-xl border border-slate-700/30 p-5">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">{card.label}</p>
            {card.value}
            <p className="text-slate-500 text-xs mt-1">{card.sub}</p>
          </div>
        ),
      )}
    </div>
  )
}
