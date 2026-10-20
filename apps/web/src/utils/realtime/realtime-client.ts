import { ApiBaseUrl } from '@/utils/http';

export type RealtimeEventHandler<T = unknown> = (payload: T) => void;

export interface RealtimeEnvelope<T = unknown> {
  v: number;
  type: string;
  event_id?: string;
  ts?: number;
  data: T;
}

export function getWebSocketBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  try {
    const url = new URL(ApiBaseUrl);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}/ws/`;
  } catch {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}/ws/`;
  }
}

/**
 * Robust singleton client for Kodinga Realtime WebSockets.
 * Handles ticket auth, auto-reconnection with exponential backoff & jitter,
 * heartbeat ping/pong, and multi-topic subscription tracking.
 */
class RealtimeClient {
  private socket: WebSocket | null = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastDisconnectTime = 0;

  // Active topic subscriptions
  private subscribedCommunities = new Set<string>();
  private subscribedPosts = new Set<string>();
  private subscribedConversations = new Set<string>();

  // Event handlers
  private handlers = new Map<string, Set<RealtimeEventHandler>>();

  // Status callbacks
  private statusListeners = new Set<(connected: boolean) => void>();

  // Gives a ticket for the WebSocket (set by useRealtimeSync: through the api client, which renews
  // an expired access token)
  private ticketProvider: (() => Promise<string | null>) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.isConnected && this.shouldReconnect) {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
      window.addEventListener('beforeunload', () => {
        this.disconnect();
      });
    }
  }

  public get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /** How to obtain a ticket (POST auth/ws-ticket/, single use, 30 s) */
  public setTicketProvider(provider: (() => Promise<string | null>) | null): void {
    this.ticketProvider = provider;
  }

  private async fetchTicket(): Promise<string | null> {
    if (!this.ticketProvider) return null;
    try {
      return await this.ticketProvider();
    } catch (err) {
      console.warn('[Realtime] Unable to obtain ticket:', err);
      return null;
    }
  }

  /**
   * Initiates the WebSocket connection.
   */
  public async connect(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.isConnected || this.isConnecting) return;

    this.isConnecting = true;
    this.shouldReconnect = true;

    const ticket = await this.fetchTicket();
    if (!ticket) {
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    try {
      const baseUrl = getWebSocketBaseUrl();
      const wsUrl = `${baseUrl}?ticket=${encodeURIComponent(ticket)}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.resubscribeAll();
        this.notifyStatus(true);

        if (this.lastDisconnectTime > 0) {
          this.emit('reconnected', { since: this.lastDisconnectTime });
          this.lastDisconnectTime = 0;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const envelope: RealtimeEnvelope = JSON.parse(event.data);
          this.handleIncomingMessage(envelope);
        } catch (e) {
          console.warn('[Realtime] Malformed frame:', event.data, e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[Realtime] WebSocket error:', err);
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.socket = null;
        this.notifyStatus(false);
        this.lastDisconnectTime = Date.now();

        if (this.shouldReconnect) {
          // If closed due to invalid credentials (4401) or forbidden (4403), back off more
          const delayMultiplier = (event.code === 4401 || event.code === 4403) ? 3 : 1;
          this.scheduleReconnect(delayMultiplier);
        }
      };
    } catch {
      this.isConnecting = false;
      this.socket = null;
      this.scheduleReconnect();
    }
  }

  /**
   * Gracefully closes the connection.
   */
  public disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.notifyStatus(false);
  }

  /**
   * Exponential backoff with jitter (1s, 2s, 4s, 8s, up to 30s).
   */
  private scheduleReconnect(multiplier = 1): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000) * multiplier;
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, 35000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ action: 'ping', ts: Date.now() });
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private send(data: Record<string, unknown>): boolean {
    if (this.isConnected && this.socket) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (err) {
        console.warn('[Realtime] Send failed:', err);
      }
    }
    return false;
  }

  /**
   * Re-sends all active subscriptions upon reconnection.
   */
  private resubscribeAll(): void {
    for (const commId of this.subscribedCommunities) {
      this.send({ action: 'subscribe_community', community_id: commId });
    }
    for (const postId of this.subscribedPosts) {
      this.send({ action: 'subscribe_post', post_id: postId });
    }
    for (const convId of this.subscribedConversations) {
      this.send({ action: 'subscribe_conversation', conversation_id: convId });
    }
  }

  // --- Subscriptions API ---

  public subscribeCommunity(communityId: string): void {
    this.subscribedCommunities.add(communityId);
    if (this.isConnected) {
      this.send({ action: 'subscribe_community', community_id: communityId });
    }
  }

  public unsubscribeCommunity(communityId: string): void {
    this.subscribedCommunities.delete(communityId);
    if (this.isConnected) {
      this.send({ action: 'unsubscribe_community', community_id: communityId });
    }
  }

  public subscribePost(postId: string): void {
    this.subscribedPosts.add(postId);
    if (this.isConnected) {
      this.send({ action: 'subscribe_post', post_id: postId });
    }
  }

  public unsubscribePost(postId: string): void {
    this.subscribedPosts.delete(postId);
    if (this.isConnected) {
      this.send({ action: 'unsubscribe_post', post_id: postId });
    }
  }

  public subscribeConversation(conversationId: string): void {
    this.subscribedConversations.add(conversationId);
    if (this.isConnected) {
      this.send({ action: 'subscribe_conversation', conversation_id: conversationId });
    }
  }

  public unsubscribeConversation(conversationId: string): void {
    this.subscribedConversations.delete(conversationId);
    if (this.isConnected) {
      this.send({ action: 'unsubscribe_conversation', conversation_id: conversationId });
    }
  }

  public sendTyping(conversationId: string, isTyping = true): void {
    if (this.isConnected) {
      this.send({
        action: 'typing',
        conversation_id: conversationId,
        is_typing: isTyping,
      });
    }
  }

  // --- Event Dispatcher ---

  public on<T = unknown>(eventType: string, handler: RealtimeEventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)?.add(handler as RealtimeEventHandler);

    return () => this.off(eventType, handler);
  }

  public off<T = unknown>(eventType: string, handler: RealtimeEventHandler<T>): void {
    const set = this.handlers.get(eventType);
    if (set) {
      set.delete(handler as RealtimeEventHandler);
      if (set.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  private emit(eventType: string, data: unknown): void {
    const set = this.handlers.get(eventType);
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[Realtime] Handler error for ${eventType}:`, e);
        }
      }
    }

    // Also trigger wildcard handlers
    const wildcardSet = this.handlers.get('*');
    if (wildcardSet) {
      for (const handler of wildcardSet) {
        try {
          handler({ type: eventType, data });
        } catch (e) {
          console.error('[Realtime] Wildcard handler error:', e);
        }
      }
    }
  }

  private handleIncomingMessage(envelope: RealtimeEnvelope): void {
    if (envelope.type === 'pong') return;
    this.emit(envelope.type, envelope.data);
  }

  // --- Connection status listeners ---

  public onStatusChange(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(connected: boolean): void {
    for (const listener of this.statusListeners) {
      try {
        listener(connected);
      } catch (err) {
        console.error('[Realtime] Status listener error:', err);
      }
    }
  }
}

export const realtimeClient = new RealtimeClient();
