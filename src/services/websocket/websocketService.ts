export type NotificationType =
  | 'order_claimed'
  | 'order_updated'
  | 'order_assigned_to_delivery'
  | 'delivery_accepted'
  | 'delivery_location_updated'
  | 'order_status_updated'

export interface OrderClaimedPayload {
  order_id: string
  user_id: string
  profile_id?: string
  status: string
  eta: string
  claimed_at: string
}

export interface OrderAssignedToDeliveryPayload {
  order_id: string
  status: string
  eta: string
  assigned_at: string
}

export interface DeliveryAcceptedPayload {
  order_id: string
  delivery_user_id: string
  delivery_accepted_at: string
}

export interface DeliveryLocationUpdatedPayload {
  order_id: string
  user_id: string
  latitude: number
  longitude: number
  timestamp: string
}

export interface OrderStatusUpdatedPayload {
  order_id: string
  status: string
  status_message?: string
  eta: string
}

export interface Notification {
  type: NotificationType
  payload: OrderClaimedPayload | OrderAssignedToDeliveryPayload | DeliveryAcceptedPayload | DeliveryLocationUpdatedPayload | unknown
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
  private role: string = 'manager'

  constructor(baseUrl: string) {
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = baseUrl.replace(/^https?:\/\//, '')
    this.url = `${wsProtocol}://${wsHost}/ws/notifications`
  }

  connect(token: string, role: 'manager' | 'delivery' = 'manager'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.token = token
    this.role = role
    this.isManualClose = false

    try {
      const urlWithParams = `${this.url}?token=${encodeURIComponent(token)}&role=${role}`
      this.ws = new WebSocket(urlWithParams)

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected as ${role}`)
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
        this.connect(this.token, this.role as 'manager' | 'delivery')
      }
    }, delay)
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      const index = this.messageHandlers.indexOf(handler)
      if (index > -1) this.messageHandlers.splice(index, 1)
    }
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.push(handler)
    return () => {
      const index = this.connectHandlers.indexOf(handler)
      if (index > -1) this.connectHandlers.splice(index, 1)
    }
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.push(handler)
    return () => {
      const index = this.disconnectHandlers.indexOf(handler)
      if (index > -1) this.disconnectHandlers.splice(index, 1)
    }
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type, payload }))
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081'
export const websocketService = new WebSocketService(API_BASE_URL)
