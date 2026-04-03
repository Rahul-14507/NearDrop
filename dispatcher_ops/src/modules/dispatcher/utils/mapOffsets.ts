import type { MapMarker } from '../types/dispatcher.types';

export function offsetOverlappingMarkers(markers: MapMarker[]): MapMarker[] {
  const threshold = 0.0001; // Approx ~11 meters
  const grouped: Record<string, MapMarker[]> = {};

  // Group markers that are very close to each other
  for (const m of markers) {
    let matchedGroup = false;
    for (const key in grouped) {
      const [gLat, gLng] = key.split(',').map(Number);
      if (
        Math.abs(m.coordinates.lat - gLat) < threshold &&
        Math.abs(m.coordinates.lng - gLng) < threshold
      ) {
        grouped[key].push(m);
        matchedGroup = true;
        break;
      }
    }
    if (!matchedGroup) {
      grouped[`${m.coordinates.lat},${m.coordinates.lng}`] = [m];
    }
  }

  // Apply deterministic coordinate offsets to groups
  const finalMarkers: MapMarker[] = [];
  for (const group of Object.values(grouped)) {
    if (group.length === 1) {
      finalMarkers.push(group[0]);
    } else {
      group.forEach((m, index) => {
        if (index === 0 && m.type === 'hub') {
          // Keep hubs at exact center if possible
          finalMarkers.push(m);
          return;
        }
        // Small radial offset (lat ± 0.001, lng ± 0.001)
        const angle = (index / (group.length || 1)) * Math.PI * 2;
        const radius = 0.001;
        finalMarkers.push({
          ...m,
          coordinates: {
            lat: m.coordinates.lat + Math.sin(angle) * radius,
            lng: m.coordinates.lng + Math.cos(angle) * radius,
          },
        });
      });
    }
  }

  return finalMarkers;
}
