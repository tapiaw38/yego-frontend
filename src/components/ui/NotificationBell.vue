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
  } from "@/services/websocket/websocketService";
  import { authService } from "@/api/authService";

  interface Notification {
    id: string;
    orderId: string;
    userId: string;
    profileId?: string;
    status: string;
    eta: string;
    claimedAt: string;
    read: boolean;
    createdAt: string;
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

    const token = authService.getToken();
    if (token) {
      if (!websocketService.isConnected()) {
        websocketService.connect(token);
      }
    }
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
    />
    <Badge
      v-if="unreadCount > 0"
      :value="unreadCount > 99 ? '99+' : unreadCount.toString()"
      severity="danger"
      class="notification-badge"
    />

    <OverlayPanel ref="panel" class="notifications-panel" :dismissable="true">
      <div class="notifications-header">
        <h3>
          Notificaciones
          <span v-if="unreadCount > 0" class="notification-count-badge">{{
            unreadCount
          }}</span>
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
          :class="{ unread: !notification.read }"
          @click="goToOrder(notification.orderId, notification.id)"
        >
          <div class="notification-content">
            <div class="notification-title">
              <i class="pi pi-shopping-bag"></i>
              <span>Nueva orden asignada</span>
              <span v-if="!notification.read" class="unread-dot"></span>
            </div>
            <div class="notification-body">
              <p class="notification-order-id">
                Orden: {{ notification.orderId.slice(0, 8) }}...
              </p>
              <p class="notification-time">
                {{ formatDate(notification.createdAt) }}
              </p>
            </div>
          </div>
          <i class="pi pi-chevron-right notification-arrow"></i>
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
    color: var(--p-surface-700) !important;
    transition: all 0.2s ease;
  }

  .notification-button:hover {
    color: var(--p-primary-600) !important;
    background: var(--p-primary-50);
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
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4);
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
  }

  .notifications-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--p-surface-200);
  }

  .notifications-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--p-surface-800);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .notification-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--p-danger-500);
    color: white;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .mark-all-read-button {
    font-size: 0.8125rem;
    padding: 0.25rem 0.5rem;
  }

  .empty-notifications {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--p-surface-500);
  }

  .empty-notifications i {
    font-size: 3rem;
    margin-bottom: 1rem;
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
    padding: 1rem;
    border-bottom: 1px solid var(--p-surface-100);
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--p-surface-0);
  }

  .notification-item:hover {
    background: var(--p-surface-50);
  }

  .notification-item.unread {
    background: var(--p-primary-50);
    border-left: 3px solid var(--p-primary-500);
  }

  .notification-item.unread:hover {
    background: var(--p-primary-100);
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--p-surface-800);
  }

  .notification-title i {
    color: var(--p-primary-500);
  }

  .unread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--p-primary-500);
    margin-left: auto;
  }

  .notification-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .notification-order-id {
    margin: 0;
    font-size: 0.875rem;
    color: var(--p-surface-600);
    font-family: monospace;
  }

  .notification-time {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--p-surface-500);
  }

  .notification-arrow {
    color: var(--p-surface-400);
    margin-left: 0.75rem;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    :deep(.notifications-panel) {
      width: calc(100vw - 2rem);
      max-width: 380px;
    }

    .notification-item {
      padding: 0.875rem;
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
