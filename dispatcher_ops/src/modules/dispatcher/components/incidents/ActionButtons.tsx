import React from 'react';
import type { Incident } from '../../types/dispatcher.types';
import { useNavigate } from 'react-router-dom';

interface ActionButtonsProps {
  incident: Incident;
  onResolve: (id: string) => void;
  onEscalate: (id: string) => void;
  onAutoAssign: (id: string) => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ incident, onResolve, onEscalate, onAutoAssign }) => {
  const navigate = useNavigate();
  const isResolved = incident.status === 'RESOLVED';
  const isEscalated = incident.status === 'ESCALATED';
  const isAssigned = incident.status === 'ASSIGNED' || incident.status === 'IN_PROGRESS';
  const canAssign = incident.status === 'NEW' || incident.status === 'PENDING';

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

      {/* Auto Assign */}
      {canAssign && (
        <button
          id={`btn-assign-${incident.id}`}
          onClick={() => onAutoAssign(incident.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all duration-300 shadow hover:shadow-lg hover:-translate-y-0.5"
          title={`Run Assignment Engine for ${incident.id}`}
        >
          Auto Assign
        </button>
      )}

      {/* Manual Override Placeholder */}
      {(isAssigned || canAssign) && (
        <button
          id={`btn-override-${incident.id}`}
          disabled
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-75"
          title="Manual override coming in V2 next sprint"
        >
          Override
        </button>
      )}

      {/* Resolve */}
      <button
        id={`btn-resolve-${incident.id}`}
        onClick={() => onResolve(incident.id)}
        disabled={isResolved}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-white transition-all duration-300 ${
          isResolved
            ? 'text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
            : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:-translate-y-0.5'
        }`}
        title={isResolved ? 'Already resolved' : `Resolve incident ${incident.id}`}
      >
        Resolve
      </button>

      {/* Escalate */}
      <button
        id={`btn-escalate-${incident.id}`}
        onClick={() => onEscalate(incident.id)}
        disabled={isEscalated || isResolved}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-white transition-all duration-300 ${
          isEscalated || isResolved
            ? 'text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
            : 'text-red-600 hover:bg-red-50 border-red-200 hover:border-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.3)] hover:-translate-y-0.5'
        }`}
        title={isEscalated ? 'Already escalated' : `Escalate incident ${incident.id}`}
      >
        Escalate
      </button>
    </div>
  );
};
