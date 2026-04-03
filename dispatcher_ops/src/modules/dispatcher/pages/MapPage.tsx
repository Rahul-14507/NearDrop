import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { LiveDispatchMap } from '../components/map/LiveDispatchMap';
import { IncidentsApi } from '../api/incidentsApi';
import { RidersApi } from '../api/ridersApi';
import { fetchWithAuth } from '../api/apiClient';
import { offsetOverlappingMarkers } from '../utils/mapOffsets';

import type { Coordinates, MapMarker, Incident, Rider, Hub } from '../types/dispatcher.types';

interface LocationState {
  focusIncidentId?: string;
  coordinates?: Coordinates;
}

export const MapPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);

  const [manualFocusId, setManualFocusId] = useState<string | undefined>(state?.focusIncidentId);
  const [manualCenter, setManualCenter] = useState<Coordinates | undefined>(state?.coordinates);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [incidentsResp, ridersResp, hubsResp] = await Promise.all([
          IncidentsApi.getActiveIncidents(),
          RidersApi.getRealtimeFleet(),
          fetchWithAuth('/api/dispatcher/hubs').then(r => r.json().then(data => ({ success: true, data })))
        ]);

        if (incidentsResp.success) setIncidents(incidentsResp.data);
        if (ridersResp.success) setRiders(ridersResp.data);
        if (hubsResp.success) {
          const mappedHubs: Hub[] = hubsResp.data.map((h: any) => ({
            id: String(h.id),
            zone: h.name,
            activeLoad: h.current_packages_held,
            maxCapacity: 50,
            availableSlots: 50 - h.current_packages_held,
            riskLevel: h.current_packages_held > 40 ? 'Critical' : h.current_packages_held > 25 ? 'Warning' : 'Safe',
            coordinates: { lat: h.lat, lng: h.lng }
          }));
          setHubs(mappedHubs);
        }
      } catch (err) {
        console.error('Failed to fetch map data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds for live telemetry if no WebSocket
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const markers: MapMarker[] = useMemo(() => {
    const hubMarkers: MapMarker[] = hubs.map(h => ({
      id: `hub-${h.id}`,
      type: 'hub',
      label: h.zone,
      coordinates: h.coordinates,
      description: `Current Load: ${h.activeLoad} / ${h.maxCapacity}`
    }));

    const driverMarkers: MapMarker[] = riders.filter(r => r.status !== 'offline').map(r => ({
      id: `driver-${r.id}`,
      type: 'driver',
      label: r.name || `Rider ${r.id}`,
      coordinates: r.coordinates || { lat: 17.43, lng: 78.44 },
      description: `Status: ${r.status}, Load: ${r.load}`,
      status: r.status
    }));

    const incidentMarkers: MapMarker[] = incidents.map(i => ({
      id: `failed-${i.id}`,
      type: 'failed_delivery',
      label: `Incident ${i.deliveryId}`,
      coordinates: i.coordinates,
      description: i.failureReason,
      deliveryId: i.deliveryId,
      status: i.status
    }));

    return offsetOverlappingMarkers([...hubMarkers, ...driverMarkers, ...incidentMarkers]);
  }, [incidents, riders, hubs]);

  const stats = useMemo(() => {
    return {
      drivers: riders.filter(r => r.status !== 'offline').length,
      failed: incidents.length,
      hubs: hubs.length,
    };
  }, [incidents, riders, hubs]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Live Dispatch Map</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time driver positions, failed delivery points, and nearest hubs — Hyderabad Zone
          </p>
        </div>

        {manualFocusId && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="text-xs font-bold text-blue-700">Focused: {manualFocusId}</span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: '🚗', label: 'Active Drivers', value: stats.drivers, color: '#3b82f6' },
          { icon: '📦', label: 'Failed Points', value: stats.failed, color: '#ef4444' },
          { icon: '🏢', label: 'Nearby Hubs', value: stats.hubs, color: '#10b981' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl px-4 py-3 shadow-sm border flex items-center gap-3" style={{ borderColor: '#e2e8f0' }}>
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-lg font-bold" style={{ color }}>{loading ? '...' : value}</p>
              <p className="text-xs text-slate-500 leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map Panel */}
      <div className="flex flex-col lg:flex-row gap-5" style={{ height: '600px' }}>
        {/* Map */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-lg relative">
          <LiveDispatchMap
            markers={markers}
            focusCenter={manualCenter}
            focusZoom={manualCenter ? 16 : 13}
            focusedIncidentId={manualFocusId}
            className="w-full h-full"
          />
          {loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 bg-white/90 backdrop-blur shadow-md rounded-full border border-slate-200 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Syncing Telemetry...</span>
            </div>
          )}
        </div>

        {/* Marker List Panel */}
        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border p-4 flex flex-col gap-3 overflow-y-auto" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Active Markers ({markers.length})</h3>
          <div className="space-y-2">
            {markers.map((marker) => {
              const isSelected = manualFocusId === marker.id.replace('driver-', '').replace('failed-', '');
              const typeConfig = {
                driver: { color: '#3b82f6', icon: '🚗' },
                failed_delivery: { color: '#ef4444', icon: '📦' },
                hub: { color: '#10b981', icon: '🏢' },
              }[marker.type];

              return (
                <button
                  key={marker.id}
                  onClick={() => {
                    const incId = marker.id.replace('driver-', '').replace('failed-', '');
                    setManualFocusId(incId);
                    setManualCenter(marker.coordinates);
                  }}
                  className={`w-full text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/80 shadow-md ring-1 ring-blue-200'
                      : 'border-slate-100 bg-slate-50/50 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{typeConfig.icon}</span>
                      <p className="text-xs font-bold text-slate-800 leading-tight">
                        {marker.label}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                        Tracking
                      </span>
                    )}
                  </div>
                  
                  {marker.description && (
                    <p className="text-[10px] text-slate-500 ml-6 leading-tight mb-1">{marker.description}</p>
                  )}
                  <p className="text-[10px] ml-6 font-mono font-bold" style={{ color: typeConfig.color }}>
                    {marker.coordinates.lat.toFixed(4)}°, {marker.coordinates.lng.toFixed(4)}°
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-3 border-t text-center" style={{ borderColor: '#f1f5f9' }}>
            <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 py-2 rounded-lg border border-emerald-100 uppercase tracking-widest">
              Live Fleet Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
