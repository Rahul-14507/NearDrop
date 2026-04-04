import React from 'react';
import type { IncidentStatus } from '../../types/dispatcher.types';

interface StatusBadgeProps {
  status: IncidentStatus;
}

const statusConfig: Record<IncidentStatus, { label: string; bg: string; color: string; dot: string }> = {
  NEW: {
    label: 'New',
    bg: 'rgba(59,130,246,0.12)',
    color: '#2563eb',
    dot: '#3b82f6',
  },
  PENDING: {
    label: 'Pending',
    bg: 'rgba(245,158,11,0.12)',
    color: '#d97706',
    dot: '#f59e0b',
  },
  ASSIGNED: {
    label: 'Assigned',
    bg: 'rgba(99,102,241,0.12)',
    color: '#4f46e5',
    dot: '#6366f1',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'rgba(168,85,247,0.12)',
    color: '#9333ea',
    dot: '#a855f7',
  },
  RESOLVED: {
    label: 'Resolved',
    bg: 'rgba(16,185,129,0.12)',
    color: '#059669',
    dot: '#10b981',
  },

  FAILED: {
    label: 'Failed',
    bg: 'rgba(71,85,105,0.12)',
    color: '#475569',
    dot: '#64748b',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: config.bg, color: config.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: config.dot }}
      />
      {config.label}
    </span>
  );
};
