import React, { useEffect } from 'react';
import { useRiderStore } from '../store/riderStore';
import { useCityStore } from '../store/cityStore';
import { RidersApi } from '../api/ridersApi';
import type { RiderStatus } from '../types/dispatcher.types';

export const RidersPage: React.FC = () => {
  const { riders, setRiders } = useRiderStore();
  const { selectedCity } = useCityStore();
  const riderList = Object.values(riders);

  useEffect(() => {
    let mounted = true;
    const fetchRiders = async () => {
      const resp = await RidersApi.getRealtimeFleet(selectedCity);
      if (mounted && resp.success) {
        setRiders(resp.data);
      }
    };
    fetchRiders();
    return () => { mounted = false; };
  }, [setRiders, selectedCity]);

  const getStatusBadge = (status: RiderStatus) => {
    switch (status) {
      case 'online':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">Online</span>;
      case 'idle':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">Idle</span>;
      case 'on-delivery':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">On Delivery</span>;
      case 'offline':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">Offline</span>;
    }
  };

  const calculateDuration = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const mins = Math.round((Date.now() - new Date(isoString).getTime()) / 60000);
    return mins <= 1 ? 'Just now' : `${mins} mins ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fleet Intelligence</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time telemetry and heartbeat states of the delivery fleet.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {riderList.map((rider) => (
          <div key={rider.id} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: '#e2e8f0' }}>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                  {rider.name?.charAt(0) || 'R'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{rider.name || rider.id}</h3>
                  <p className="text-xs font-mono text-slate-500">{rider.id}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(rider.status)}
                {rider.currentTask && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                    Task: {rider.currentTask}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-dashed border-slate-200 mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Trust Score</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-sm font-bold ${rider.score > 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {rider.score}%
                  </span>
                  {rider.band && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      rider.band === 'Elite' ? 'bg-emerald-100 text-emerald-700' :
                      rider.band === 'Reliable' ? 'bg-blue-100 text-blue-700' :
                      rider.band === 'Needs Attention' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{rider.band}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Zone</span>
                <span className="text-sm font-semibold text-slate-700">{rider.zone}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Today's Load</span>
                <span className="text-sm font-bold text-slate-700">{rider.load} Tasks</span>
              </div>
            </div>

            {/* Heartbeat Timeline */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-2 uppercase">Heartbeat Telemetry</p>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${rider.status === 'offline' ? 'bg-slate-300' : 'bg-blue-400 animate-pulse'}`}></span>
                    Last Active Ping
                  </span>
                  <span className="font-mono text-slate-700">{calculateDuration(rider.lastActiveTimestamp)}</span>
                </div>
                
                {rider.status === 'idle' && rider.idleSince && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5 ml-3">↳ Idle duration</span>
                    <span className="font-mono text-slate-700">{calculateDuration(rider.idleSince)}</span>
                  </div>
                )}

                {rider.status === 'on-delivery' && rider.onDeliverySince && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5 ml-3">↳ Driving duration</span>
                    <span className="font-mono text-slate-700">{calculateDuration(rider.onDeliverySince)}</span>
                  </div>
                )}
                
                {rider.etaToHub !== undefined && rider.status === 'on-delivery' && (
                  <div className="flex justify-between items-center text-xs border-t border-slate-200 border-dashed pt-2 mt-2">
                    <span className="text-slate-500">Predicted ETA to Hub</span>
                    <span className="font-bold text-blue-600">{rider.etaToHub} mins</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
