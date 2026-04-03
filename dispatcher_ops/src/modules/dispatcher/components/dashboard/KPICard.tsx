import React from 'react';
import type { KPIStat, KPITrend } from '../../types/dispatcher.types';

interface KPICardProps {
  stat: KPIStat;
}

const trendConfig: Record<KPITrend, { color: string; arrow: string; bg: string }> = {
  up: { color: '#10b981', arrow: '↑', bg: 'rgba(16,185,129,0.1)' },
  down: { color: '#f59e0b', arrow: '↓', bg: 'rgba(245,158,11,0.1)' },
  neutral: { color: '#64748b', arrow: '→', bg: 'rgba(100,116,139,0.1)' },
};

export const KPICard: React.FC<KPICardProps> = ({ stat }) => {
  const trend = trendConfig[stat.trend];

  return (
    <div
      id={`kpi-card-${stat.id}`}
      className="bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:border-blue-200 cursor-default"
      style={{ borderColor: '#e2e8f0' }}
    >
      {/* Icon + Trend */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: '#f1f5f9' }}
        >
          {stat.icon}
        </div>
        {stat.trendValue && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: trend.color, background: trend.bg }}
          >
            {trend.arrow} {stat.trendValue}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-800">{stat.value}</span>
        {stat.unit && (
          <span className="text-base font-medium text-slate-400">{stat.unit}</span>
        )}
      </div>

      {/* Label */}
      <p className="mt-1 text-sm font-medium text-slate-500">{stat.label}</p>
    </div>
  );
};
