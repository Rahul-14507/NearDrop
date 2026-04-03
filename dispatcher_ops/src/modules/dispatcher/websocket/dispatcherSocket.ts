import { useWebsocketStatusStore } from '../store/websocketStatusStore';
import type { SocketEvent, SocketEventType } from '../types/dispatcher.types';

export type SocketEventHandler<T = any> = (payload: T) => void;

/**
 * DispatchSocket - V2 Resilient WebSocket Engine
 * ----------------------------------------------
 * Handles real-time telemetry and push events from the FastAPI backend.
 * Implements exponential backoff reconnects and syncs state to Zustand.
 */
class DispatcherSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<SocketEventType, SocketEventHandler[]> = new Map();
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 7; // E.g., max ~2 mins total wait
  private baseReconnectDelay = 1000; // 1s
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    useWebsocketStatusStore.getState().setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING' as any);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      
    } catch (err) {
      console.error('[WebSocket] Initialization error:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    useWebsocketStatusStore.getState().setStatus('DISCONNECTED');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public on<T>(type: SocketEventType, handler: SocketEventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  public off<T>(type: SocketEventType, handler: SocketEventHandler<T>): void {
    const handlers = this.handlers.get(type);
    if (!handlers) return;
    this.handlers.set(type, handlers.filter(h => h !== handler));
  }

  private handleOpen(): void {
    console.info('[WebSocket] Connected');
    this.reconnectAttempts = 0;
    useWebsocketStatusStore.getState().resetReconnectAttempts();
    useWebsocketStatusStore.getState().setStatus('CONNECTED');
  }

  private handleMessage(event: MessageEvent): void {
    useWebsocketStatusStore.getState().recordEvent();
    try {
      const raw = JSON.parse(event.data);
      // Map backend {"type": "...", "data": {...}} to frontend expected format
      const data = {
        type: raw.type as SocketEventType,
        payload: raw.data || raw.payload || {},
        timestamp: raw.timestamp || new Date().toISOString()
      } as SocketEvent;

      const handlers = this.handlers.get(data.type) || [];
      handlers.forEach(handler => handler(data.payload));
    } catch (e) {
      console.error('[WebSocket] Failed to process message', e);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.warn(`[WebSocket] Closed (Code: ${event.code})`);
    this.ws = null;
    this.scheduleReconnect();
  }

  private handleError(_event: Event): void {
    // Errors naturally trigger onClose automatically in standard WebSockets
    console.error('[WebSocket] Error detected');
  }

  private scheduleReconnect(): void {
    useWebsocketStatusStore.getState().setStatus('DISCONNECTED');
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect limit reached. Staying dead.');
      useWebsocketStatusStore.getState().setStatus('STALE_DATA');
      return;
    }

    const delay = Math.min(30000, this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts));
    console.info(`[WebSocket] Reconnecting in ${delay}ms...`);
    
    useWebsocketStatusStore.getState().incrementReconnectAttempts();
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton export
export const dispatcherSocket = new DispatcherSocket(
  import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
);
