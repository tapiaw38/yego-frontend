<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useToast } from "primevue/usetoast";
import Toast from "primevue/toast";
import Badge from "primevue/badge";
import { orderService } from "@/api/orderService";
import type { Order } from "@/types/order";
import { calculateOrderTotal, formatPrice } from "@/types/order";
import { AppHeader } from "@/components/ui";
import { useWebSocket } from "@/composables/useWebSocket";
import { websocketService } from "@/services/websocket/websocketService";
import type {
  OrderAssignedToDeliveryPayload,
  OrderStatusUpdatedPayload,
} from "@/services/websocket/websocketService";

const toast = useToast();
const orders = ref<Order[]>([]);
const loading = ref(true);
const accepting = ref<Record<string, boolean>>({});
const expandedOrderId = ref<string | null>(null);
const trackingActive = ref(false);
const trackingOrderId = ref<string | null>(null);
let watchId: number | null = null;

const statusLabels: Record<string, string> = {
  CREATED: "Creado",
  CONFIRMED: "Confirmado",
  PREPARING: "En Preparación",
  ON_THE_WAY: "En Camino",
  DELIVERED: "Entregado",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
};

const statusColors: Record<string, string> = {
  CREATED: "#6b7280",
  CONFIRMED: "#3b82f6",
  PREPARING: "#f59e0b",
  ON_THE_WAY: "#8b5cf6",
  DELIVERED: "#10b981",
  PAUSED: "#f59e0b",
  CANCELLED: "#ef4444",
};

const pendingOrders = computed(() =>
  orders.value.filter((o) => !o.delivery_accepted_at)
);
const acceptedOrders = computed(() =>
  orders.value.filter((o) => !!o.delivery_accepted_at)
);

const fetchOrders = async () => {
  loading.value = true;
  try {
    const res = await orderService.getDeliveryOrders();
    orders.value = res.orders ?? [];
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudieron cargar las entregas",
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const acceptDelivery = async (order: Order) => {
  if (accepting.value[order.id]) return;
  accepting.value[order.id] = true;
  try {
    await orderService.acceptDelivery(order.id);
    const idx = orders.value.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
      orders.value[idx] = {
        ...orders.value[idx],
        delivery_accepted_at: new Date().toISOString(),
      };
    }
    toast.add({
      severity: "success",
      summary: "Entrega aceptada",
      detail: "Fuiste asignado a esta entrega",
      life: 3000,
    });
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo aceptar la entrega",
      life: 3000,
    });
  } finally {
    accepting.value[order.id] = false;
  }
};

const toggleExpand = (orderId: string) => {
  expandedOrderId.value = expandedOrderId.value === orderId ? null : orderId;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const startTracking = (orderId: string) => {
  if (!("geolocation" in navigator)) {
    toast.add({
      severity: "warn",
      summary: "GPS no disponible",
      detail: "Tu dispositivo no soporta geolocalización",
      life: 3000,
    });
    return;
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }

  trackingOrderId.value = orderId;
  trackingActive.value = true;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      websocketService.send("location_update", {
        order_id: orderId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    },
    (err) => {
      console.error("Geolocation error:", err);
      toast.add({
        severity: "error",
        summary: "Error de GPS",
        detail: "No se pudo obtener tu ubicación",
        life: 3000,
      });
      stopTracking();
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
};

const stopTracking = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  trackingActive.value = false;
  trackingOrderId.value = null;
};

// Listen for WebSocket events
useWebSocket({
  onOrderAssignedToDelivery: (payload: OrderAssignedToDeliveryPayload) => {
    const exists = orders.value.some((o) => o.id === payload.order_id);
    if (!exists) {
      fetchOrders();
    }
    toast.add({
      severity: "info",
      summary: "Nueva entrega asignada",
      detail: `Orden #${payload.order_id.slice(0, 8)}`,
      life: 5000,
    });
  },
  onOrderStatusUpdated: (payload: OrderStatusUpdatedPayload) => {
    const idx = orders.value.findIndex((o) => o.id === payload.order_id);
    if (idx !== -1) {
      orders.value[idx] = {
        ...orders.value[idx],
        status: payload.status,
        status_message: payload.status_message,
        eta: payload.eta,
      };
    }
    toast.add({
      severity: "info",
      summary: "Estado actualizado",
      detail: `Orden #${payload.order_id.slice(0, 8)} → ${statusLabels[payload.status] ?? payload.status}`,
      life: 4000,
    });
  },
});

onMounted(fetchOrders);
onUnmounted(stopTracking);
</script>

<template>
  <div class="delivery-page">
    <AppHeader title="Mis Entregas" />
    <Toast />

    <main class="delivery-main">
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem" />
        <p>Cargando entregas...</p>
      </div>

      <template v-else>
        <!-- Pending section -->
        <section class="orders-section">
          <div class="section-header">
            <h2>Pendientes de aceptación</h2>
            <Badge
              v-if="pendingOrders.length"
              :value="pendingOrders.length"
              severity="warn"
            />
          </div>

          <div v-if="!pendingOrders.length" class="empty-state">
            <i class="pi pi-inbox" />
            <p>No hay entregas pendientes</p>
          </div>

          <div v-else class="orders-list">
            <div
              v-for="order in pendingOrders"
              :key="order.id"
              class="order-card pending"
            >
              <div class="order-card-header" @click="toggleExpand(order.id)">
                <div class="order-info">
                  <span class="order-id">#{{ order.id.slice(0, 8) }}</span>
                  <span
                    class="order-status"
                    :style="{ color: statusColors[order.status] }"
                  >
                    {{ statusLabels[order.status] ?? order.status }}
                  </span>
                </div>
                <div class="order-meta">
                  <span class="order-total">
                    {{ formatPrice(calculateOrderTotal(order.data)) }}
                  </span>
                  <span class="order-date">{{ formatDate(order.created_at) }}</span>
                  <i
                    class="pi"
                    :class="expandedOrderId === order.id ? 'pi-chevron-up' : 'pi-chevron-down'"
                  />
                </div>
              </div>

              <div v-if="expandedOrderId === order.id" class="order-detail">
                <!-- Customer info -->
                <div v-if="order.profile_info" class="customer-info">
                  <div v-if="order.profile_info.phone_number" class="info-row">
                    <i class="pi pi-phone" />
                    <a :href="`tel:${order.profile_info.phone_number}`" class="info-link">
                      {{ order.profile_info.phone_number }}
                    </a>
                  </div>
                  <div v-if="order.profile_info.address" class="info-row">
                    <i class="pi pi-map-marker" />
                    <a
                      v-if="order.profile_info.latitude && order.profile_info.longitude"
                      :href="`https://www.google.com/maps?q=${order.profile_info.latitude},${order.profile_info.longitude}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="info-link"
                    >
                      {{ order.profile_info.address }}
                    </a>
                    <span v-else>{{ order.profile_info.address }}</span>
                  </div>
                </div>

                <div v-if="order.data?.items?.length" class="items-list">
                  <div
                    v-for="item in order.data.items"
                    :key="item.name"
                    class="item-row"
                  >
                    <span class="item-name">{{ item.name }}</span>
                    <span class="item-qty">x{{ item.quantity }}</span>
                    <span class="item-price">{{ formatPrice(item.price * item.quantity) }}</span>
                  </div>
                </div>
                <p v-else class="no-items">Sin items registrados</p>
                <div class="order-eta" v-if="order.eta">
                  <i class="pi pi-clock" /> ETA: {{ order.eta }}
                </div>
              </div>

              <div class="order-card-actions">
                <button
                  class="btn-accept"
                  :disabled="accepting[order.id]"
                  @click="acceptDelivery(order)"
                >
                  <i class="pi pi-check" />
                  {{ accepting[order.id] ? "Aceptando..." : "Aceptar entrega" }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Accepted section -->
        <section class="orders-section">
          <div class="section-header">
            <h2>Entregas aceptadas</h2>
            <Badge
              v-if="acceptedOrders.length"
              :value="acceptedOrders.length"
              severity="success"
            />
          </div>

          <div v-if="!acceptedOrders.length" class="empty-state">
            <i class="pi pi-truck" />
            <p>Aún no aceptaste ninguna entrega</p>
          </div>

          <div v-else class="orders-list">
            <div
              v-for="order in acceptedOrders"
              :key="order.id"
              class="order-card accepted"
            >
              <div class="order-card-header" @click="toggleExpand(order.id)">
                <div class="order-info">
                  <span class="order-id">#{{ order.id.slice(0, 8) }}</span>
                  <span
                    class="order-status"
                    :style="{ color: statusColors[order.status] }"
                  >
                    {{ statusLabels[order.status] ?? order.status }}
                  </span>
                  <span class="accepted-badge">
                    <i class="pi pi-check-circle" /> Aceptada
                  </span>
                </div>
                <div class="order-meta">
                  <span class="order-total">
                    {{ formatPrice(calculateOrderTotal(order.data)) }}
                  </span>
                  <span class="order-date">{{ formatDate(order.created_at) }}</span>
                  <i
                    class="pi"
                    :class="expandedOrderId === order.id ? 'pi-chevron-up' : 'pi-chevron-down'"
                  />
                </div>
              </div>

              <div v-if="expandedOrderId === order.id" class="order-detail">
                <!-- Customer info -->
                <div v-if="order.profile_info" class="customer-info">
                  <div v-if="order.profile_info.phone_number" class="info-row">
                    <i class="pi pi-phone" />
                    <a :href="`tel:${order.profile_info.phone_number}`" class="info-link">
                      {{ order.profile_info.phone_number }}
                    </a>
                  </div>
                  <div v-if="order.profile_info.address" class="info-row">
                    <i class="pi pi-map-marker" />
                    <a
                      v-if="order.profile_info.latitude && order.profile_info.longitude"
                      :href="`https://www.google.com/maps?q=${order.profile_info.latitude},${order.profile_info.longitude}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="info-link"
                    >
                      {{ order.profile_info.address }}
                    </a>
                    <span v-else>{{ order.profile_info.address }}</span>
                  </div>
                </div>

                <div v-if="order.data?.items?.length" class="items-list">
                  <div
                    v-for="item in order.data.items"
                    :key="item.name"
                    class="item-row"
                  >
                    <span class="item-name">{{ item.name }}</span>
                    <span class="item-qty">x{{ item.quantity }}</span>
                    <span class="item-price">{{ formatPrice(item.price * item.quantity) }}</span>
                  </div>
                </div>
                <p v-else class="no-items">Sin items registrados</p>
                <div class="order-eta" v-if="order.eta">
                  <i class="pi pi-clock" /> ETA: {{ order.eta }}
                </div>
                <div class="accepted-at" v-if="order.delivery_accepted_at">
                  <i class="pi pi-calendar-check" />
                  Aceptada: {{ formatDate(order.delivery_accepted_at) }}
                </div>
              </div>

              <div class="order-card-actions">
                <div
                  v-if="trackingOrderId === order.id && trackingActive"
                  class="tracking-indicator"
                >
                  <span class="tracking-dot" />
                  Compartiendo ubicación
                </div>
                <button
                  v-if="trackingOrderId === order.id && trackingActive"
                  class="btn-stop-tracking"
                  @click="stopTracking"
                >
                  <i class="pi pi-stop-circle" /> Detener
                </button>
                <button
                  v-else
                  class="btn-start-tracking"
                  @click="startTracking(order.id)"
                >
                  <i class="pi pi-map-marker" /> Compartir ubicación
                </button>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.delivery-page {
  min-height: 100vh;
  background: var(--surface-ground, #f8fafc);
}

.delivery-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: var(--color-text-muted);
}

.orders-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-header h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  background: var(--bg-white, #fff);
  border-radius: 0.75rem;
  border: 1px dashed var(--border-light, #e5e7eb);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.empty-state .pi {
  font-size: 2rem;
  opacity: 0.4;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.order-card {
  background: var(--bg-white, #fff);
  border-radius: 0.75rem;
  border: 1px solid var(--border-light, #e5e7eb);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.order-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.order-card.pending {
  border-left: 3px solid #f59e0b;
}

.order-card.accepted {
  border-left: 3px solid #10b981;
}

.order-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  cursor: pointer;
  user-select: none;
}

.order-info {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.order-id {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text-primary);
  font-family: monospace;
}

.order-status {
  font-size: 0.8125rem;
  font-weight: 500;
}

.accepted-badge {
  font-size: 0.75rem;
  color: #10b981;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.order-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.order-total {
  font-weight: 600;
  color: var(--color-text-primary);
}

.order-detail {
  border-top: 1px solid var(--border-light, #e5e7eb);
  padding: 0.875rem 1rem;
  background: var(--surface-ground, #f8fafc);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: color-mix(in srgb, var(--color-primary, #6366f1) 5%, white);
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.info-row .pi {
  color: var(--color-primary, #6366f1);
  font-size: 0.8125rem;
  flex-shrink: 0;
}

.info-link {
  color: var(--color-primary, #6366f1);
  text-decoration: none;
  font-weight: 500;
}

.info-link:hover {
  text-decoration: underline;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.item-name {
  flex: 1;
  color: var(--color-text-primary);
}

.item-qty {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.item-price {
  font-weight: 500;
  color: var(--color-text-primary);
}

.no-items {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.order-eta,
.accepted-at {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.order-card-actions {
  padding: 0.625rem 1rem;
  border-top: 1px solid var(--border-light, #e5e7eb);
  display: flex;
  justify-content: flex-end;
}

.btn-accept {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-primary, #6366f1);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-accept:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-accept:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tracking-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #10b981;
  font-weight: 500;
}

.tracking-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.btn-start-tracking {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 1rem;
  background: transparent;
  color: var(--color-primary, #6366f1);
  border: 1px solid var(--color-primary, #6366f1);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-start-tracking:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.btn-stop-tracking {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 1rem;
  background: transparent;
  color: #ef4444;
  border: 1px solid #ef4444;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-stop-tracking:hover {
  background: color-mix(in srgb, #ef4444 8%, transparent);
}

@media (max-width: 480px) {
  .order-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .order-meta {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
