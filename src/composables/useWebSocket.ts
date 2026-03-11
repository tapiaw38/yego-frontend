import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import {
  websocketService,
  type Notification,
  type OrderClaimedPayload,
  type OrderAssignedToDeliveryPayload,
  type DeliveryAcceptedPayload,
  type DeliveryLocationUpdatedPayload,
  type OrderStatusUpdatedPayload,
} from '@/services/websocket/websocketService'

export interface UseWebSocketOptions {
  autoConnect?: boolean
  onOrderClaimed?: (payload: OrderClaimedPayload) => void
  onOrderAssignedToDelivery?: (payload: OrderAssignedToDeliveryPayload) => void
  onDeliveryAccepted?: (payload: DeliveryAcceptedPayload) => void
  onDeliveryLocationUpdated?: (payload: DeliveryLocationUpdatedPayload) => void
  onOrderStatusUpdated?: (payload: OrderStatusUpdatedPayload) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export interface UseWebSocketReturn {
  isConnected: Ref<boolean>
  connect: (token: string, role?: 'manager' | 'delivery') => void
  disconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const isConnected = ref(false)
  let unsubscribeMessage: (() => void) | null = null
  let unsubscribeConnect: (() => void) | null = null
  let unsubscribeDisconnect: (() => void) | null = null

  const handleMessage = (notification: Notification) => {
    switch (notification.type) {
      case 'order_claimed':
        options.onOrderClaimed?.(notification.payload as OrderClaimedPayload)
        break
      case 'order_assigned_to_delivery':
        options.onOrderAssignedToDelivery?.(notification.payload as OrderAssignedToDeliveryPayload)
        break
      case 'delivery_accepted':
        options.onDeliveryAccepted?.(notification.payload as DeliveryAcceptedPayload)
        break
      case 'delivery_location_updated':
        options.onDeliveryLocationUpdated?.(notification.payload as DeliveryLocationUpdatedPayload)
        break
      case 'order_status_updated':
        options.onOrderStatusUpdated?.(notification.payload as OrderStatusUpdatedPayload)
        break
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
    isConnected.value = websocketService.isConnected()
  })

  onUnmounted(() => {
    unsubscribeMessage?.()
    unsubscribeConnect?.()
    unsubscribeDisconnect?.()
  })

  const connect = (token: string, role: 'manager' | 'delivery' = 'manager') => {
    websocketService.connect(token, role)
  }

  const disconnect = () => {
    websocketService.disconnect()
  }

  return { isConnected, connect, disconnect }
}
