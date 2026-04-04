import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CityState {
  selectedCity: string;
  availableCities: string[];
  setSelectedCity: (city: string) => void;
  setAvailableCities: (cities: string[]) => void;
}

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      selectedCity: 'All Cities',
      availableCities: [
        'All Cities',
        'Hyderabad',
        'Mumbai',
        'Chennai',
        'Delhi',
        'Bengaluru',
        'Kolkata'
      ],
      setSelectedCity: (city) => set({ selectedCity: city }),
      setAvailableCities: (cities) => set({ availableCities: cities }),
    }),
    {
      name: 'neardrop-city-storage',
    }
  )
);
