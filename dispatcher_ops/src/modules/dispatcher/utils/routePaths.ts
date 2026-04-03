import type { Coordinates, MapMarker } from '../types/dispatcher.types';

// Calculate straight-line distance (Haversine formula in km)
function getDistance(c1: Coordinates, c2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find the nearest hub for a given failed delivery coordinate
export function findNearestHub(coords: Coordinates, hubs: MapMarker[]): MapMarker | null {
  if (hubs.length === 0) return null;
  
  let nearest = hubs[0];
  let minDistance = Infinity;

  hubs.forEach((hub) => {
    const dist = getDistance(coords, hub.coordinates);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = hub;
    }
  });

  return nearest;
}

