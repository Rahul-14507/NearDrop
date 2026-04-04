import React from 'react';
import type { Incident } from '../../types/dispatcher.types';
import { useNavigate } from 'react-router-dom';

interface ActionButtonsProps {
  incident: Incident;
  onResolve: (id: string) => void;
  onAssign: (id: string) => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ incident, onResolve, onAssign }) => {
  const navigate = useNavigate();
  const isResolved = incident.status === 'RESOLVED';
  const isAssigned = incident.status === 'ASSIGNED' || incident.status === 'IN_PROGRESS';
  const assignLabel = isAssigned ? 'Reassign' : 'Assign';

  const handleTrack = () => {
    // Navigate to map with this incident's coordinates stored in state
    navigate('/dispatcher/map', {
      state: { focusIncidentId: incident.id, coordinates: incident.coordinates },
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Track */}
      <button
        id={`btn-track-${incident.id}`}
        onClick={handleTrack}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-[0_0_8px_rgba(59,130,246,0.3)] hover:-translate-y-0.5"
        title={`Track ${incident.deliveryId} on map`}
      >
        Track
      </button>

      {/* Assign / Reassign */}
      <button
        id={`btn-assign-${incident.id}`}
        onClick={() => onAssign(incident.id)}
        disabled={isResolved}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shadow hover:-translate-y-0.5 ${
          isResolved 
            ? 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-50 shadow-none'
            : isAssigned
            ? 'text-white bg-slate-800 hover:bg-slate-900 border border-slate-700'
            : 'text-white bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
        }`}
        title={`${assignLabel} ${incident.id}`}
      >
        {assignLabel}
      </button>

      {/* Resolve */}
      <button
        id={`btn-resolve-${incident.id}`}
        onClick={() => onResolve(incident.id)}
        disabled={isResolved}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-white transition-all duration-300 ${
          isResolved
            ? 'text-slate-400 border border-slate-200 cursor-not-allowed opacity-50 shadow-none'
            : 'text-emerald-600 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:-translate-y-0.5'
        }`}
        title={isResolved ? 'Already resolved' : `Resolve incident ${incident.id}`}
      >
        Resolve
      </button>
    </div>
  );
};
