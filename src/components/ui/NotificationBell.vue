<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import OverlayPanel from "primevue/overlaypanel";
import Badge from "primevue/badge";
import { useWebSocket } from "@/composables/useWebSocket";
import {
  websocketService,
  type OrderClaimedPayload,
  type OrderAssignedToDeliveryPayload,
} from "@/services/websocket/websocketService";
import { authService } from "@/api/authService";
import { orderService } from "@/api/orderService";

type NotificationKind = 'order_claimed' | 'order_assigned_to_delivery';

interface Notification {
  id: string;
  kind: NotificationKind;
  orderId: string;
  userId: string;
  profileId?: string;
  status: string;
  eta: string;
  claimedAt: string;
  read: boolean;
  createdAt: string;
  accepting?: boolean;
  accepted?: boolean;
}

const router = useRouter();
const panel = ref<InstanceType<typeof OverlayPanel>>();
const notifications = ref<Notification[]>([]);

const unreadCount = computed(() => {
  return notifications.value.filter((n) => !n.read).length;
});

const unreadNotifications = computed(() => {
  return notifications.value.filter((n) => !n.read);
});

const hasNotifications = computed(() => {
  return unreadNotifications.value.length > 0;
});

const togglePanel = (event: Event) => {
  panel.value?.toggle(event);
};

const markAsRead = (notificationId: string) => {
  const notification = notifications.value.find(
    (n) => n.id === notificationId,
  );
  if (notification) {
    notification.read = true;
    cleanupReadNotifications();
    saveNotifications();
  }
};

const markAllAsRead = () => {
  notifications.value.forEach((n) => (n.read = true));
  cleanupReadNotifications();
  saveNotifications();
};

const cleanupReadNotifications = () => {
  if (unreadCount.value === 0) {
    notifications.value = [];
  }
};

const goToOrder = (orderId: string, notificationId: string) => {
  markAsRead(notificationId);
  router.push(`/order/${orderId}`);
  panel.value?.hide();
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Hace un momento";
  if (diffMins < 60)
    return `Hace ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
  if (diffHours < 24)
    return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const addNotification = (payload: OrderClaimedPayload) => {
  const notification: Notification = {
    id: `${payload.order_id}-${Date.now()}`,
    kind: 'order_claimed',
    orderId: payload.order_id,
    userId: payload.user_id,
    profileId: payload.profile_id,
    status: payload.status,
    eta: payload.eta,
    claimedAt: payload.claimed_at,
    read: false,
    createdAt: new Date().toISOString(),
  };

  notifications.value.unshift(notification);

  if (notifications.value.length > 50) {
    notifications.value = notifications.value.slice(0, 50);
  }

  saveNotifications();
};

const addDeliveryNotification = (payload: OrderAssignedToDeliveryPayload) => {
  const notification: Notification = {
    id: `delivery-${payload.order_id}-${Date.now()}`,
    kind: 'order_assigned_to_delivery',
    orderId: payload.order_id,
    userId: '',
    status: payload.status,
    eta: payload.eta,
    claimedAt: payload.assigned_at,
    read: false,
    createdAt: new Date().toISOString(),
  };

  notifications.value.unshift(notification);

  if (notifications.value.length > 50) {
    notifications.value = notifications.value.slice(0, 50);
  }

  saveNotifications();
};

const acceptDelivery = async (notification: Notification) => {
  if (notification.accepting || notification.accepted) return;
  notification.accepting = true;
  try {
    await orderService.acceptDelivery(notification.orderId);
    notification.accepted = true;
    notification.read = true;
    saveNotifications();
  } catch (err) {
    console.error('Error accepting delivery:', err);
  } finally {
    notification.accepting = false;
  }
};

const loadNotifications = () => {
  const saved = localStorage.getItem("yego_notifications");
  if (saved) {
    try {
      notifications.value = JSON.parse(saved);
    } catch {
      notifications.value = [];
    }
  }
};

const saveNotifications = () => {
  localStorage.setItem(
    "yego_notifications",
    JSON.stringify(notifications.value),
  );
};

useWebSocket({
  onOrderClaimed: (payload: OrderClaimedPayload) => {
    addNotification(payload);
  },
  onOrderAssignedToDelivery: (payload: OrderAssignedToDeliveryPayload) => {
    addDeliveryNotification(payload);
  },
});

const updatePageTitle = () => {
  const baseTitle = "Yego";
  if (unreadCount.value > 0) {
    document.title = `(${unreadCount.value}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
};

watch(
  unreadCount,
  () => {
    updatePageTitle();
  },
  { immediate: true },
);

onMounted(() => {
  loadNotifications();
  updatePageTitle();
  // WebSocket connection is managed by AppHeader (which knows the user role)
});

onUnmounted(() => {
  saveNotifications();
  document.title = "Yego";
});
</script>

<template>
  <div class="notification-bell-container">
    <Button
      icon="pi pi-bell"
      text
      rounded
      class="notification-button"
      @click="togglePanel"
      aria-label="Notificaciones"
    />
    <Badge
      v-if="unreadCount > 0"
      :value="unreadCount > 99 ? '99+' : unreadCount.toString()"
      severity="danger"
      class="notification-badge"
    />

    <OverlayPanel ref="panel" class="notifications-panel" :dismissable="true">
      <div class="notifications-header">
        <h3 class="notifications-title">
          Notificaciones
          <span v-if="unreadCount > 0" class="notification-count-badge">
            {{ unreadCount }}
          </span>
        </h3>
        <Button
          v-if="unreadCount > 0"
          label="Marcar todas como leídas"
          text
          size="small"
          class="mark-all-read-button"
          @click="markAllAsRead"
        />
      </div>

      <div v-if="!hasNotifications" class="empty-notifications">
        <i class="pi pi-bell-slash"></i>
        <p>No hay notificaciones</p>
      </div>

      <div v-else class="notifications-list">
        <div
          v-for="notification in unreadNotifications"
          :key="notification.id"
          class="notification-item"
          :class="{ unread: !notification.read, 'delivery-item': notification.kind === 'order_assigned_to_delivery' }"
        >
          <!-- Delivery notification: con botón Aceptar -->
          <template v-if="notification.kind === 'order_assigned_to_delivery'">
            <div class="notification-content">
              <div class="notification-title">
                <i class="pi pi-truck text-primary"></i>
                <span>Nueva entrega disponible</span>
                <span v-if="!notification.read" class="unread-dot" aria-hidden="true"></span>
              </div>
              <div class="notification-body">
                <p class="notification-order-id">
                  Orden: {{ notification.orderId.slice(0, 8) }}...
                </p>
                <p v-if="notification.eta" class="notification-eta">ETA: {{ notification.eta }}</p>
                <p class="notification-time">{{ formatDate(notification.createdAt) }}</p>
              </div>
              <div class="notification-actions">
                <Button
                  v-if="!notification.accepted"
                  :label="notification.accepting ? 'Aceptando...' : 'Aceptar entrega'"
                  :loading="notification.accepting"
                  size="small"
                  class="accept-btn"
                  @click.stop="acceptDelivery(notification)"
                />
                <span v-else class="accepted-label">
                  <i class="pi pi-check-circle"></i> Aceptada
                </span>
              </div>
            </div>
          </template>

          <!-- Regular notification: order claimed -->
          <template v-else>
            <div
              class="notification-content"
              role="button"
              tabindex="0"
              @click="goToOrder(notification.orderId, notification.id)"
              @keydown.enter="goToOrder(notification.orderId, notification.id)"
            >
              <div class="notification-title">
                <i class="pi pi-shopping-bag text-primary"></i>
                <span>Nueva orden asignada</span>
                <span v-if="!notification.read" class="unread-dot" aria-hidden="true"></span>
              </div>
              <div class="notification-body">
                <p class="notification-order-id">
                  Orden: {{ notification.orderId.slice(0, 8) }}...
                </p>
                <p class="notification-time">{{ formatDate(notification.createdAt) }}</p>
              </div>
            </div>
            <i class="pi pi-chevron-right notification-arrow"></i>
          </template>
        </div>
      </div>
    </OverlayPanel>
  </div>
</template>

<style scoped>
.notification-bell-container {
  position: relative;
  display: inline-block;
}

.notification-button {
  color: var(--color-text-secondary) !important;
  transition: all var(--transition-fast);
}

.notification-button:hover {
  color: var(--color-primary) !important;
  background: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;
}

.notification-button :deep(.p-button-icon) {
  color: inherit !important;
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0 6px;
  border: 2px solid var(--bg-white);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-danger) 40%, transparent);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.notifications-panel) {
  width: 380px;
  max-width: 90vw;
  max-height: 500px;
  padding: 0;
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 40px var(--shadow-medium);
  border: 1px solid var(--border-light);
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
}

.notifications-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.notification-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--color-danger);
  color: var(--color-text-white);
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.mark-all-read-button {
  font-size: 0.8125rem;
  padding: 0.25rem var(--spacing-xs);
}

.empty-notifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl) var(--spacing-md);
  color: var(--color-text-muted);
}

.empty-notifications i {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.empty-notifications p {
  margin: 0;
  font-size: 0.9375rem;
}

.notifications-list {
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--surface-ground);
  cursor: pointer;
  transition: background var(--transition-fast);
  background: var(--bg-white);
  outline: none;
}

.notification-item:hover,
.notification-item:focus-visible {
  background: var(--surface-hover);
}

.notification-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--border-focus);
}

.notification-item.unread {
  background: color-mix(in srgb, var(--color-primary) 5%, var(--bg-white));
  border-left: 3px solid var(--color-primary);
}

.notification-item.unread:hover {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-white));
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text-primary);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  margin-left: auto;
  flex-shrink: 0;
}

.notification-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.notification-order-id {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.notification-time {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.notification-arrow {
  color: var(--vt-c-gray-400);
  margin-left: var(--spacing-sm);
  flex-shrink: 0;
}

.notification-eta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.notification-actions {
  margin-top: var(--spacing-xs);
}

.accept-btn {
  font-size: 0.8125rem !important;
  padding: 0.25rem 0.75rem !important;
  background: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

.accepted-label {
  font-size: 0.8125rem;
  color: var(--color-success, #10b981);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.delivery-item {
  border-left: 3px solid var(--color-primary) !important;
  background: color-mix(in srgb, var(--color-primary) 5%, var(--bg-white)) !important;
}

@media (max-width: 640px) {
  :deep(.notifications-panel) {
    width: calc(100vw - 2rem);
    max-width: 380px;
  }

  .notification-item {
    padding: var(--spacing-sm);
  }

  .notification-title {
    font-size: 0.875rem;
  }

  .notification-order-id,
  .notification-time {
    font-size: 0.75rem;
  }
}
</style>
