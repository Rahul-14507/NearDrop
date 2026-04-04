import { fetchWithAuth } from './apiClient';
import type { ApiResponse, City } from '../types/dispatcher.types';
import { CITY_MAP_CONFIG } from '../constants/mapConstants';

export const CitiesApi = {
  getAvailableCities: async (): Promise<ApiResponse<City[]>> => {
    // In a real app, this might fetch from /api/dispatcher/cities
    // For now, we derive it from our configured map constants (excluding "All Cities")
    try {
      const cities: City[] = Object.entries(CITY_MAP_CONFIG)
        .filter(([name]) => name !== 'All Cities')
        .map(([name, config], index) => ({
          id: `city-${index}`,
          name,
          coordinates: { lat: config.lat, lng: config.lng },
          zoom: config.zoom,
        }));

      return {
        success: true,
        data: cities,
      };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  },
};
