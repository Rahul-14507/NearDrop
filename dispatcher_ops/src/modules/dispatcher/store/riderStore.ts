import { create } from 'zustand';
import type { Rider, RiderStatus } from '../types/dispatcher.types';

interface RiderState {
  riders: Record<string, Rider>;
  
  // Actions
  setRiders: (riders: Rider[]) => void;
  upsertRider: (rider: Rider) => void;
  updateRiderStatus: (id: string, status: RiderStatus) => void;
  getOnlineRiders: () => Rider[];
}

export const useRiderStore = create<RiderState>((set, get) => ({
  riders: {},

  setRiders: (riders: Rider[]) => {
    const record: Record<string, Rider> = {};
    riders.forEach((rider) => {
      record[rider.id] = rider;
    });
    set({ riders: record });
  },

  upsertRider: (rider: Rider) => {
    set((state) => ({
      riders: {
        ...state.riders,
        [rider.id]: rider,
      },
    }));
  },

  updateRiderStatus: (id: string, status: RiderStatus) => {
    set((state) => {
      const rider = state.riders[id];
      if (!rider) return state;
      return {
        riders: {
          ...state.riders,
          [id]: { ...rider, status },
        },
      };
    });
  },

  getOnlineRiders: () => {
    const ridersArray = Object.values(get().riders);
    return ridersArray.filter((r) => r.status !== 'offline');
  },
}));
