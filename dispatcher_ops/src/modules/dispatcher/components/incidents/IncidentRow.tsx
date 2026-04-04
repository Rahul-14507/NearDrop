import React from 'react';
import type { Incident } from '../../types/dispatcher.types';
import { StatusBadge } from './StatusBadge';
import { ActionButtons } from './ActionButtons';
import { SLAEngine } from '../../services/slaEngine';

interface IncidentRowProps {
  incident: Incident;
  index: number;
  onResolve: (id: string) => void;
  onAssign: (id: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

export const IncidentRow: React.FC<IncidentRowProps> = ({ incident, index, onResolve, onAssign }) => {
  const slaStatus = SLAEngine.evaluateSLA(incident);

  return (
    <tr
      id={`incident-row-${incident.id}`}
      className={`border-b hover:bg-blue-50/40 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
      style={{ borderColor: '#f1f5f9' }}
    >
      {/* Delivery ID */}
      <td className="px-5 py-4">
        <span className="font-mono text-sm font-semibold text-slate-700">{incident.deliveryId}</span>
        <p className="text-xs text-slate-400 mt-0.5 font-mono">{incident.id}</p>
      </td>

      {/* Driver ID */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            {incident.driverId.slice(-2)}
          </div>
          <span className="text-sm font-medium text-slate-700">{incident.driverId}</span>
        </div>
      </td>

      {/* Location */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm text-slate-600">{incident.location}</span>
        </div>
        {incident.failureReason && (
          <p className="text-xs text-slate-400 mt-0.5 ml-5">{incident.failureReason}</p>
        )}
      </td>

      {/* Time & SLA */}
      <td className="px-5 py-4">
        <span className="text-sm text-slate-600 mb-1 block">{formatTime(incident.timestamp)}</span>
        {incident.status !== 'RESOLVED' && incident.status !== 'FAILED' && (
          <div className={`flex items-center gap-1.5 text-xs font-bold ${
            slaStatus.severity === 'breached' ? 'text-red-600' :
            slaStatus.severity === 'critical' ? 'text-orange-500 rounded bg-orange-50 px-1 py-0.5 inline-block' :
            slaStatus.severity === 'warning' ? 'text-amber-500' : 
            'text-slate-500'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={slaStatus.severity === 'breached' ? 'animate-pulse' : ''}>
              {slaStatus.formattedTime} {slaStatus.isBreached ? 'breached' : 'left'}
            </span>
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <StatusBadge status={incident.status} />
      </td>

      {/* Actions */}
      <td className="px-5 py-4">
        <ActionButtons
          incident={incident}
          onResolve={onResolve}
          onAssign={onAssign}
        />
      </td>
    </tr>
  );
};
