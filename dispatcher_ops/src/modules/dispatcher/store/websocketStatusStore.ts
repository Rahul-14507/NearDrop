import { create } from 'zustand';

export type WebsocketStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'STALE_DATA';

interface WebsocketState {
  status: WebsocketStatus;
  lastEventTimestamp: string | null;
  reconnectAttempts: number;
  
  // Actions
  setStatus: (status: WebsocketStatus) => void;
  recordEvent: () => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useWebsocketStatusStore = create<WebsocketState>((set) => ({
  status: 'DISCONNECTED',
  lastEventTimestamp: null,
  reconnectAttempts: 0,

  setStatus: (status: WebsocketStatus) => {
    set({ status });
  },

  recordEvent: () => {
    set({ lastEventTimestamp: new Date().toISOString() });
  },

  incrementReconnectAttempts: () => {
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 }));
  },

  resetReconnectAttempts: () => {
    set({ reconnectAttempts: 0 });
  },
}));
