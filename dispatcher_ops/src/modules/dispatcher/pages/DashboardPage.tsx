import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KPICard } from '../components/dashboard/KPICard';
import { StatusBadge } from '../components/incidents/StatusBadge';
import { useIncidents } from '../hooks/useIncidents';
import { AnalyticsApi } from '../api/analyticsApi';
import type { KPIStat } from '../types/dispatcher.types';

export const DashboardPage: React.FC = () => {
  const { incidents, loading: incidentsLoading } = useIncidents();
  const [stats, setStats] = useState<KPIStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const resp = await AnalyticsApi.getGlobalMetrics();
      if (resp.success) {
        // Map backend metrics to KPIStat format
        const kpiData: KPIStat[] = [
          {
            id: 'kpi-1',
            label: 'Success Rate',
            value: resp.data.rerouteSuccess,
            unit: '%',
            trend: 'up',
            trendValue: 'Live score',
            icon: '📈',
          },
          {
            id: 'kpi-2',
            label: 'Incidents Today',
            value: resp.data.breachCount,
            trend: 'down',
            trendValue: 'Active',
            icon: '⚠️',
          },
          {
            id: 'kpi-3',
            label: 'Avg Response',
            value: resp.data.avgResTime,
            unit: 'min',
            trend: 'neutral',
            trendValue: 'Target < 5m',
            icon: '⏱️',
          },
          {
            id: 'kpi-4',
            label: 'System Health',
            value: 98,
            unit: '%',
            trend: 'up',
            icon: '🌐',
          }
        ];
        setStats(kpiData);
      }
      setStatsLoading(false);
    };
    fetchStats();
  }, []);

  // Show the 5 most recent incidents
  const recentIncidents = incidents.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10" style={{ background: '#3b82f6' }} />
        <div className="absolute right-20 -bottom-6 w-24 h-24 rounded-full opacity-10" style={{ background: '#6366f1' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Live Operations</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Welcome back, Dispatcher</h2>
          <p className="text-blue-200 text-sm">
            Hyderabad operations zone — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Quick action links */}
        <div className="mt-5 flex gap-3 relative z-10">
          <Link
            to="/dispatcher/incidents"
            className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/20 backdrop-blur-sm"
          >
            View Incidents →
          </Link>
          <Link
            to="/dispatcher/map"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/10 backdrop-blur-sm"
          >
            Live Map →
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-4">Key Performance Indicators</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {statsLoading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl border border-slate-200" />
            ))
          ) : (
            stats.map((stat) => (
              <KPICard key={stat.id} stat={stat} />
            ))
          )}
        </div>
      </section>

      {/* Recent Incidents + Zone Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Incidents Table */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#e2e8f0' }}>
            <h3 className="text-sm font-bold text-slate-800">Recent Incidents</h3>
            <Link to="/dispatcher/incidents" className="text-xs text-blue-600 font-semibold hover:text-blue-800">
              View all →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {incidentsLoading ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">Loading telemetry...</div>
            ) : recentIncidents.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">No active incidents in your zone.</div>
            ) : (
              recentIncidents.map((incident) => (
                <div key={incident.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-700">{incident.deliveryId}</span>
                      <StatusBadge status={incident.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{incident.location} — Driver ID: {incident.driverId}</p>
                  </div>
                  <Link
                    to="/dispatcher/incidents"
                    className="ml-3 text-xs text-blue-600 font-medium hover:text-blue-800 flex-shrink-0"
                  >
                    Manage
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zone Status Panel */}
        <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="text-sm font-bold text-slate-800 mb-4">Zone Status</h3>
          {[
            { zone: 'Banjara Hills', deliveries: 42, health: 94, color: '#10b981' },
            { zone: 'Gachibowli', deliveries: 38, health: 88, color: '#10b981' },
            { zone: 'Kukatpally', deliveries: 51, health: 71, color: '#f59e0b' },
            { zone: 'Secunderabad', deliveries: 29, health: 96, color: '#10b981' },
            { zone: 'LB Nagar', deliveries: 33, health: 65, color: '#ef4444' },
          ].map(({ zone, deliveries, health, color }) => (
            <div key={zone} className="mb-4 last:mb-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-slate-700">{zone}</span>
                <span className="text-xs font-bold" style={{ color }}>{health}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${health}%`, background: color }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{deliveries} active deliveries</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
