import React, { useEffect } from 'react';
import { useAlertStore } from '../store/alertStore';
import { AlertsApi } from '../api/alertsApi';

export const AlertsPage: React.FC = () => {
  const { alerts, addAlert, acknowledgeAlert, clearResolvedTips, getUnacknowledgedCount } = useAlertStore();
  const unacknowledgedCount = getUnacknowledgedCount();

  useEffect(() => {
    let mounted = true;
    const fetchMissedAlerts = async () => {
      // Only fetch if empty to prevent duplicating on nav
      if (alerts.length > 0) return;
      
      const resp = await AlertsApi.getRecentAlerts();
      if (mounted && resp.success) {
        resp.data.reverse().forEach(a => addAlert(a));
      }
    };
    fetchMissedAlerts();
    return () => { mounted = false; };
  }, [addAlert, alerts.length]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Alerts & Watchtower</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time critical events, SLA breaches, and hub network capacity warnings.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => clearResolvedTips()}
            className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Clear Acknowledged
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 border border-orange-200">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-bold text-orange-700">{unacknowledgedCount} Action Required</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="font-semibold text-sm">No new alerts tracked.</p>
            <p className="text-xs">Network conditions are operating nominally.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-5 flex items-start gap-4 transition-colors ${!alert.acknowledged ? 'bg-slate-50/50' : 'bg-white opacity-75'}`}
              >
                {/* Icon Column */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                  alert.severity === 'warning' ? 'bg-orange-100 text-orange-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {alert.type === 'HUB_CAPACITY' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  ) : alert.type === 'SLA_RISK' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex justify-between items-start mb-1">
                    <p className={`text-sm font-bold ${!alert.acknowledged ? 'text-slate-800' : 'text-slate-600'}`}>
                      {alert.type.replace('_', ' ')}
                    </p>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 leading-snug ${!alert.acknowledged ? 'text-slate-700' : 'text-slate-500'}`}>
                    {alert.message}
                  </p>
                  
                  {alert.relatedEntityId && (
                    <p className="mt-2 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 inline-block px-1.5 py-0.5 rounded border border-slate-200">
                      REF: {alert.relatedEntityId}
                    </p>
                  )}
                </div>

                {/* Action */}
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors whitespace-nowrap"
                  >
                    Acknowledge
                  </button>
                )}
                {alert.acknowledged && (
                  <div className="ml-4 flex items-center gap-1 text-emerald-500">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wide">Ack</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
