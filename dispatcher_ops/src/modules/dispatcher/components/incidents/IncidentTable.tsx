import React, { useState } from 'react';
import type { Incident, IncidentStatus } from '../../types/dispatcher.types';
import { IncidentRow } from './IncidentRow';

interface IncidentTableProps {
  incidents: Incident[];
  loading?: boolean;
  onResolve: (id: string) => void;
  onEscalate: (id: string) => void;
  onAutoAssign: (id: string) => void;
}

type FilterStatus = 'All' | IncidentStatus;

const columns = ['Delivery ID', 'Driver ID', 'Location', 'Time', 'Status', 'Actions'];

export const IncidentTable: React.FC<IncidentTableProps> = ({ incidents, loading, onResolve, onEscalate, onAutoAssign }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filterOptions: FilterStatus[] = ['All', 'NEW', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'];

  const filtered = incidents
    .filter((i) => filterStatus === 'All' || i.status === filterStatus)
    .filter((i) =>
      searchQuery.trim() === '' ||
      i.deliveryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.driverId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
      {/* Table Header Controls */}
      <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 justify-between" style={{ borderColor: '#e2e8f0' }}>
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="incident-search"
            type="text"
            placeholder="Search deliveries, drivers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            style={{ borderColor: '#e2e8f0' }}
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions.map((option) => (
            <button
              key={option}
              id={`filter-${option.toLowerCase()}`}
              onClick={() => setFilterStatus(option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filterStatus === option
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {option}
              {option !== 'All' && (
                <span className="ml-1 opacity-75">
                  ({incidents.filter((i) => i.status === option).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  <div className="flex justify-center items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading incidents...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map((incident, idx) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  index={idx}
                  onResolve={onResolve}
                  onEscalate={onEscalate}
                  onAutoAssign={onAutoAssign}
                />
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium">No incidents found</p>
                    <p className="text-xs">Try adjusting your filters or search</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
          <span className="font-semibold text-slate-700">{incidents.length}</span> incidents
        </p>
        <p className="text-xs text-slate-400">Last synced: just now</p>
      </div>
    </div>
  );
};
