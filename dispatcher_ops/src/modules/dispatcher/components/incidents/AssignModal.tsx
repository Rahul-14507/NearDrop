import React, { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../api/apiClient';
import type { Incident } from '../../types/dispatcher.types';

interface AssignModalProps {
  incident: Incident;
  onClose: () => void;
  onConfirm: (riderId: string) => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({ incident, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(true);
  const [driverInfo, setDriverInfo] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchRecommendation = async () => {
      try {
        const resp = await fetchWithAuth(`/api/dispatcher/drivers?city=${encodeURIComponent(incident.city)}`);
        const drivers = await resp.json();
        if (mounted && drivers && drivers.length > 0) {
          const sorted = drivers.sort((a: any, b: any) => b.trust_score - a.trust_score);
          setDriverInfo(sorted[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchRecommendation();
    return () => { mounted = false; };
  }, [incident.city]);

  if (!incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Assign Driver</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          {loading ? (
             <div className="flex justify-center items-center py-6">
                <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
             </div>
          ) : driverInfo ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{driverInfo.name || `DRV-${driverInfo.id}`}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  driverInfo.trust_score >= 90 ? 'bg-emerald-100 text-emerald-700' :
                  driverInfo.trust_score >= 80 ? 'bg-blue-100 text-blue-700' :
                  driverInfo.trust_score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>{driverInfo.trust_score}% Trust</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wide">ETA</span>
                  <span className="font-semibold text-slate-700">6 mins</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wide">Active Load</span>
                  <span className="font-semibold text-slate-700">{driverInfo.today_assigned || 0} items</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-500 font-medium">No suitable drivers found</p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Cancel</button>
          <button 
            disabled={!driverInfo || loading}
            onClick={() => onConfirm(String(driverInfo.id))} 
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
