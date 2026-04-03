/**
 * socket.ts — NearDrop Dispatcher WebSocket Service (V1 Placeholder)
 * ------------------------------------------------------------------
 * Skeleton for the real-time WebSocket layer that connects to the
 * FastAPI backend's reroute engine in V2.
 *
 * WebSocket URL should be configured via env:
 *   VITE_WS_URL
 * ------------------------------------------------------------------
 */

import type { SocketEvent, SocketEventType } from '../types/dispatcher.types';

export type SocketEventHandler<T = unknown> = (event: SocketEvent<T>) => void;

/**
 * DispatchSocket
 * V1: A no-op mock socket that logs events.
 * V2: Replace createConnection() with real WebSocket initialization.
 */
export class DispatchSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<SocketEventType, SocketEventHandler[]> = new Map();
  private readonly url: string;

  constructor(url: string = 'ws://localhost:8000/ws/dispatcher') {
    this.url = url;
  }

  /**
   * Connect to the WebSocket server.
   * V1: Logs a placeholder message.
   * V2: Uncomment and implement real connection logic.
   */
  connect(): void {
    console.info(`[Socket] V1 Placeholder — would connect to: ${this.url}`);
    // TODO V2:
    // this.ws = new WebSocket(this.url);
    // this.ws.onmessage = (event) => this.handleMessage(event);
    // this.ws.onopen = () => console.info('[Socket] Connected');
    // this.ws.onclose = () => console.warn('[Socket] Disconnected');
    // this.ws.onerror = (err) => console.error('[Socket] Error:', err);
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    console.info('[Socket] Disconnected');
  }

  /**
   * Subscribe to specific socket event types.
   */
  on<T>(eventType: SocketEventType, handler: SocketEventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as SocketEventHandler);
  }

  /**
   * Unsubscribe from a specific socket event type.
   */
  off(eventType: SocketEventType): void {
    this.handlers.delete(eventType);
  }

  /**
   * Internal message router.
   */
  // @ts-ignore - Reserved for future WebSocket implementation
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as SocketEvent;
      const handlers = this.handlers.get(data.type) ?? [];
      handlers.forEach((h) => h(data));
    } catch {
      console.error('[Socket] Failed to parse message:', event.data);
    }
  }
}

/**
 * Singleton socket factory.
 * V1: Returns placeholder instance.
 */
let socketInstance: DispatchSocket | null = null;

export function createDispatchSocket(): DispatchSocket {
  if (!socketInstance) {
    socketInstance = new DispatchSocket(
      import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws/dispatcher'
    );
  }
  return socketInstance;
}
