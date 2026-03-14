import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import {
  websocketService,
  type Notification,
  type OrderClaimedPayload,
  type OrderCreatedPayload,
  type OrderUpdatedPayload,
} from '@/services/websocket/websocketService'

export interface UseWebSocketOptions {
  autoConnect?: boolean
  onOrderClaimed?: (payload: OrderClaimedPayload) => void
  onOrderCreated?: (payload: OrderCreatedPayload) => void
  onOrderUpdated?: (payload: OrderUpdatedPayload) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export interface UseWebSocketReturn {
  isConnected: Ref<boolean>
  connect: (token: string) => void
  disconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const isConnected = ref(false)
  let unsubscribeMessage: (() => void) | null = null
  let unsubscribeConnect: (() => void) | null = null
  let unsubscribeDisconnect: (() => void) | null = null

  const handleMessage = (notification: Notification) => {
    if (notification.type === 'order_claimed' && options.onOrderClaimed) {
      options.onOrderClaimed(notification.payload as OrderClaimedPayload)
    }
    if (notification.type === 'order_created' && options.onOrderCreated) {
      options.onOrderCreated(notification.payload as OrderCreatedPayload)
    }
    if (notification.type === 'order_updated' && options.onOrderUpdated) {
      options.onOrderUpdated(notification.payload as OrderUpdatedPayload)
    }
  }

  const handleConnect = () => {
    isConnected.value = true
    options.onConnected?.()
  }

  const handleDisconnect = () => {
    isConnected.value = false
    options.onDisconnected?.()
  }

  onMounted(() => {
    unsubscribeMessage = websocketService.onMessage(handleMessage)
    unsubscribeConnect = websocketService.onConnect(handleConnect)
    unsubscribeDisconnect = websocketService.onDisconnect(handleDisconnect)

    // Set initial connection state
    isConnected.value = websocketService.isConnected()
  })

  onUnmounted(() => {
    unsubscribeMessage?.()
    unsubscribeConnect?.()
    unsubscribeDisconnect?.()
  })

  const connect = (token: string) => {
    websocketService.connect(token)
  }

  const disconnect = () => {
    websocketService.disconnect()
  }

  return {
    isConnected,
    connect,
    disconnect,
  }
}
