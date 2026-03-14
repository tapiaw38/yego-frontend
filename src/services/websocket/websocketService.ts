export type NotificationType = 'order_claimed' | 'order_created' | 'order_updated'

export interface OrderClaimedPayload {
  order_id: string
  user_id: string
  profile_id?: string
  status: string
  eta: string
  claimed_at: string
}

export interface OrderCreatedPayload {
  order_id: string
  profile_id?: string
  status: string
  eta: string
  created_at: string
}

export interface OrderUpdatedPayload {
  order_id: string
  status: string
  eta: string
}

export interface Notification {
  type: NotificationType
  payload: OrderClaimedPayload | OrderCreatedPayload | OrderUpdatedPayload | unknown
}

type MessageHandler = (notification: Notification) => void
type ConnectionHandler = () => void

export class WebSocketService {
  private ws: WebSocket | null = null
  private readonly url: string
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private isManualClose = false
  private messageHandlers: MessageHandler[] = []
  private connectHandlers: ConnectionHandler[] = []
  private disconnectHandlers: ConnectionHandler[] = []
  private token: string | null = null

  constructor(baseUrl: string) {
    // Convert http:// or https:// to ws:// or wss://
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = baseUrl.replace(/^https?:\/\//, '')
    this.url = `${wsProtocol}://${wsHost}/ws/notifications`
  }

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.token = token
    this.isManualClose = false

    try {
      const urlWithToken = `${this.url}?token=${encodeURIComponent(token)}`
      this.ws = new WebSocket(urlWithToken)

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected')
        this.reconnectAttempts = 0
        this.connectHandlers.forEach(handler => handler())
      }

      this.ws.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data)
          console.log('[WebSocket] Message received:', notification)
          this.messageHandlers.forEach(handler => handler(notification))
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        this.disconnectHandlers.forEach(handler => handler())

        if (!this.isManualClose) {
          this.attemptReconnect()
        }
      }

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
      }
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error)
      this.attemptReconnect()
    }
  }

  disconnect(): void {
    this.isManualClose = true
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      if (this.token) {
        this.connect(this.token)
      }
    }, delay)
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      const index = this.messageHandlers.indexOf(handler)
      if (index > -1) {
        this.messageHandlers.splice(index, 1)
      }
    }
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.push(handler)
    return () => {
      const index = this.connectHandlers.indexOf(handler)
      if (index > -1) {
        this.connectHandlers.splice(index, 1)
      }
    }
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.push(handler)
    return () => {
      const index = this.disconnectHandlers.indexOf(handler)
      if (index > -1) {
        this.disconnectHandlers.splice(index, 1)
      }
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Create singleton instance
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081'
export const websocketService = new WebSocketService(API_BASE_URL)
