import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapMarker, MarkerType, Coordinates } from '../../types/dispatcher.types';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '../../constants/mapConstants';
// Removed routeWaypoints and RoutingControl imports


// ─── Fix Leaflet default marker icons (broken with bundlers) ──────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Custom SVG Marker Icons ──────────────────────────────────────────────────
function createCustomIcon(type: MarkerType): L.DivIcon {
  const configs: Record<MarkerType, { color: string; emoji: string; label: string }> = {
    driver: { color: '#3b82f6', emoji: '🚗', label: 'Driver' },
    failed_delivery: { color: '#ef4444', emoji: '📦', label: 'Failed' },
    hub: { color: '#10b981', emoji: '🏢', label: 'Hub' },
  };
  const cfg = configs[type];

  return L.divIcon({
    className: '',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      ">
        <div style="
          width: 40px;
          height: 40px;
          background: ${cfg.color};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          <span style="transform: rotate(45deg); font-size: 16px;">${cfg.emoji}</span>
        </div>
        <div style="
          background: ${cfg.color};
          color: white;
          font-size: 10px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 2px;
          white-space: nowrap;
        ">${cfg.label}</div>
      </div>
    `,
    iconSize: [50, 60],
    iconAnchor: [25, 55],
    popupAnchor: [0, -60],
  });
}

// ─── Map Focus Controller ─────────────────────────────────────────────────────
interface MapFocusProps {
  center: Coordinates;
  zoom: number;
}

const MapFocusController: React.FC<MapFocusProps> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

// ─── Legend ──────────────────────────────────────────────────────────────────
const MapLegend: React.FC = () => (
  <div
    className="absolute bottom-5 right-5 z-[1000] bg-white rounded-xl shadow-lg p-3 border"
    style={{ borderColor: '#e2e8f0' }}
  >
    <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Legend</p>
    {[
      { color: '#3b82f6', label: 'Driver Location' },
      { color: '#ef4444', label: 'Failed Delivery' },
      { color: '#10b981', label: 'Nearby Hub' },
    ].map(({ color, label }) => (
      <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
        <span className="text-xs text-slate-600">{label}</span>
      </div>
    ))}
    <div className="flex items-center gap-2 mb-1 mt-2 pt-2 border-t" style={{ borderColor: '#e2e8f0' }}>
      <div className="w-4 border-t-2 border-dashed border-blue-500" />
      <span className="text-xs text-slate-600">Driver Path</span>
    </div>
    <div className="flex items-center gap-2 mb-1">
      <div className="w-4 border-t-2 border-dashed border-orange-500" />
      <span className="text-xs text-slate-600">Reroute Path</span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
interface LiveDispatchMapProps {
  markers: MapMarker[];
  focusCenter?: Coordinates;
  focusZoom?: number;
  focusedIncidentId?: string;
  className?: string;
}

export const LiveDispatchMap: React.FC<LiveDispatchMapProps> = ({
  markers,
  focusCenter,
  focusZoom = 14,
  focusedIncidentId,
  className = '',
}) => {
  const center = focusCenter ?? MAP_DEFAULT_CENTER;
  const zoom = focusCenter ? focusZoom : MAP_DEFAULT_ZOOM;

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-sm border ${className}`} style={{ borderColor: '#e2e8f0' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        {/* Tile Layer — OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Dynamic focus when center changes */}
        <MapFocusController center={center} zoom={zoom} />

        {/* Markers */}
        {markers.map((marker) => {
          const isFocused = focusedIncidentId && (
            marker.id === `driver-${focusedIncidentId}` || 
            marker.id === `failed-${focusedIncidentId}`
          );
          const opacity = focusedIncidentId ? (isFocused || marker.type === 'hub' ? 1 : 0.4) : 1;

          return (
            <Marker
              key={marker.id}
              position={[marker.coordinates.lat, marker.coordinates.lng]}
              icon={createCustomIcon(marker.type)}
              opacity={opacity}
              ref={(r) => {
                if (r && isFocused && marker.type === 'failed_delivery') {
                  setTimeout(() => r.openPopup(), 400); 
                }
              }}
            >
              <Popup className="transition-opacity duration-300">
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '160px' }}>
                  <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px', color: '#0f172a' }}>
                    {marker.label}
                  </p>
                  {marker.description && (
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{marker.description}</p>
                  )}
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    {marker.coordinates.lat.toFixed(4)}°N, {marker.coordinates.lng.toFixed(4)}°E
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend overlay */}
      <MapLegend />
    </div>
  );
};
