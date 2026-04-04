import React, { useEffect } from 'react';
import { useAnalyticsStore } from '../store/analyticsStore';
import { useCityStore } from '../store/cityStore';
import { AnalyticsApi } from '../api/analyticsApi';

export const AnalyticsPage: React.FC = () => {
  const {
    riderLeaderboard,
    failureZones,
    avgResolutionTime,
    slaBreachCount,
    rerouteSuccessRate,
    carbonReduction,
    costSaved,
    setLeaderboard,
    setFailureZones,
    setGlobalMetrics,
  } = useAnalyticsStore();

  const { selectedCity } = useCityStore();

  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      // Fetch in parallel for speed
      const [lbResp, fzResp, gmResp] = await Promise.all([
        AnalyticsApi.getLeaderboard(selectedCity),
        AnalyticsApi.getFailureZones(selectedCity),
        AnalyticsApi.getGlobalMetrics(selectedCity),
      ]);

      if (mounted) {
        if (lbResp.success) setLeaderboard(lbResp.data);
        if (fzResp.success) setFailureZones(fzResp.data);
        if (gmResp.success) setGlobalMetrics(gmResp.data);
      }
    };

    fetchAnalytics();
    return () => { mounted = false; };
  }, [setLeaderboard, setFailureZones, setGlobalMetrics, selectedCity]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Analytics Command Center</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          High-level operational metrics mapping to backend BI aggregates.
        </p>
      </div>

      {/* Global Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs lg:text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide text-center">Avg Resolution</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-black text-blue-600">{avgResolutionTime}</span>
            <span className="text-xs font-bold text-blue-400">mins</span>
          </div>
        </div>

        <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs lg:text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide text-center">SLA Breaches</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-black text-red-600">{slaBreachCount}</span>
            <span className="text-xs font-bold text-red-400">issues</span>
          </div>
        </div>

        <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-sm">
          <p className="text-xs lg:text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide text-center">Reroute Success</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-black text-emerald-600">{rerouteSuccessRate}%</span>
          </div>
        </div>

        <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-sm">
          <p className="text-xs lg:text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide text-center">CO₂ Reduced</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-black text-teal-600">{carbonReduction}%</span>
          </div>
        </div>

        <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs lg:text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide text-center">Cost Saved</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-black text-indigo-600">₹{costSaved.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Leaderboard Widget */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Elite Fleet Leaderboard</h3>
            <p className="text-xs text-slate-500">Top riders by trust score</p>
          </div>
          <div className="divide-y divide-slate-50">
            {riderLeaderboard.map((rider, idx) => (
              <div key={rider.riderId} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? 'bg-amber-100 text-amber-600' :
                    idx === 1 ? 'bg-slate-200 text-slate-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-500'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{rider.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{rider.riderId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{rider.score}%</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{rider.completedDeliveries} Trips</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Failure Zones Widget */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">High-Risk Failure Zones</h3>
            <p className="text-xs text-slate-500">Regions generating the most incident tickets</p>
          </div>
          <div className="divide-y divide-slate-50">
            {failureZones.map((zoneData) => (
              <div key={zoneData.zone} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-700 text-sm">{zoneData.zone}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    zoneData.riskLevel === 'high' ? 'bg-red-100 text-red-600' :
                    zoneData.riskLevel === 'medium' ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {zoneData.riskLevel} Risk
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-800">{zoneData.failedCount}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Failures</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
