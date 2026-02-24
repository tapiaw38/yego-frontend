<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import { orderService } from "../api/orderService";
  import { authService } from "../api/authService";
  import type { Order } from "../types/order";
  import {
    StatusLabels,
    StatusIcons,
    calculateOrderTotal,
    formatPrice,
  } from "../types/order";
  import yegoLogo from "../assets/img/yego-logo.png";
  import { AppHeader } from "@/components/ui";
  import { isAdmin } from "@/types/auth";

  const router = useRouter();
  const isUserAdmin = ref(false);
  const currentUser = ref<{ first_name?: string; email?: string } | null>(null);
  const orders = ref<Order[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const fetchOrders = async () => {
    try {
      const response = await orderService.getMyOrders();
      orders.value = response.orders;
      error.value = null;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message ||
        "No se pudieron cargar las ordenes";
    } finally {
      loading.value = false;
    }
  };

  const goToOrder = (orderId: string) => {
    router.push(`/order/${orderId}`);
  };

  const goBack = () => {
    router.push("/profile");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "status-delivered";
      case "CANCELLED":
        return "status-cancelled";
      case "PAUSED":
        return "status-paused";
      case "ON_THE_WAY":
        return "status-on-way";
      default:
        return "status-pending";
    }
  };

  const checkUser = async () => {
    if (authService.isAuthenticated()) {
      try {
        const response = await authService.me();
        currentUser.value = response.data;
        isUserAdmin.value = isAdmin(response.data);
      } catch {
        // Silent fail
      }
    }
  };

  onMounted(() => {
    fetchOrders();
    checkUser();
  });
</script>

<template>
  <div class="orders-view">
    <AppHeader
      title="Mis Pedidos"
      show-back
      :is-admin="isUserAdmin"
      :user-name="currentUser?.first_name"
      :user-email="currentUser?.email"
      @back="goBack"
    />

    <main class="main-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando pedidos...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon"><i class="pi pi-exclamation-triangle"></i></div>
        <h2>Error</h2>
        <p>{{ error }}</p>
        <button @click="fetchOrders" class="retry-button">
          Intentar de nuevo
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="orders.length === 0" class="empty-state">
        <div class="empty-icon"><i class="pi pi-box"></i></div>
        <h2>Sin pedidos</h2>
        <p>Aun no tienes pedidos realizados</p>
      </div>

      <!-- Orders List -->
      <div v-else class="orders-list">
        <div
          v-for="order in orders"
          :key="order.id"
          class="order-card"
          @click="goToOrder(order.id)"
        >
          <div class="order-header">
            <span :class="['status-badge', getStatusClass(order.status)]">
              {{ StatusIcons[order.status] }} {{ StatusLabels[order.status] }}
            </span>
            <span class="order-date">{{ formatDate(order.created_at) }}</span>
          </div>

          <div class="order-body">
            <div class="order-info">
              <div class="order-id">
                <span class="label">Pedido:</span>
                <span class="value">#{{ order.id.slice(0, 8) }}</span>
              </div>
              <div v-if="order.eta" class="order-eta">
                <span class="label">ETA:</span>
                <span class="value">{{ order.eta }}</span>
              </div>
            </div>

            <div v-if="order.data?.items" class="order-items">
              <div class="items-summary">
                <span class="items-count"
                  >{{ order.data.items.length }} producto(s)</span
                >
                <span class="items-total">{{
                  formatPrice(calculateOrderTotal(order.data))
                }}</span>
              </div>
              <div class="items-preview">
                <span
                  v-for="(item, index) in order.data.items.slice(0, 3)"
                  :key="index"
                  class="item-name"
                >
                  {{ item.name
                  }}<span
                    v-if="index < Math.min(order.data.items.length, 3) - 1"
                    >,
                  </span>
                </span>
                <span v-if="order.data.items.length > 3" class="more-items">
                  y {{ order.data.items.length - 3 }} mas...
                </span>
              </div>
            </div>
          </div>

          <div class="order-footer">
            <span class="view-details">Ver detalle &rarr;</span>
          </div>
        </div>
      </div>
    </main>

    <footer class="app-footer">
      <img :src="yegoLogo" alt="Yego" class="footer-logo" />
      <p>Powered by Gillie AI</p>
    </footer>
  </div>
</template>

<style scoped>
  .orders-view {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--surface-ground);
  }

  .main-content {
    flex: 1;
    padding: 1rem;
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-icon,
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .error-state h2,
  .empty-state h2 {
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .error-state p,
  .empty-state p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  .retry-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .retry-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .orders-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .order-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    cursor: pointer;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .order-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .status-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 20px;
  }

  .status-delivered {
    background: #d1fae5;
    color: #065f46;
  }

  .status-cancelled {
    background: #fee2e2;
    color: #991b1b;
  }

  .status-paused {
    background: #fef3c7;
    color: #92400e;
  }

  .status-on-way {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-pending {
    background: #f3f4f6;
    color: #374151;
  }

  .order-date {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .order-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .order-info {
    display: flex;
    gap: 1.5rem;
  }

  .order-id,
  .order-eta {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .label {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }

  .order-items {
    padding-top: 0.75rem;
    border-top: 1px solid #f3f4f6;
  }

  .items-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .items-count {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .items-total {
    font-size: 1rem;
    font-weight: 700;
    color: #667eea;
  }

  .items-preview {
    font-size: 0.75rem;
    color: #9ca3af;
    line-height: 1.4;
  }

  .item-name {
    color: #6b7280;
  }

  .more-items {
    color: #9ca3af;
    font-style: italic;
  }

  .order-footer {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #f3f4f6;
    text-align: right;
  }

  .view-details {
    font-size: 0.875rem;
    color: #667eea;
    font-weight: 500;
  }

  .app-footer {
    background: white;
    padding: 1rem;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .footer-logo {
    height: 24px;
    width: auto;
    opacity: 0.7;
  }

  .app-footer p {
    color: #9ca3af;
    font-size: 0.875rem;
    margin: 0;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .app-header {
      padding: 0.75rem;
    }

    .back-button {
      font-size: 1.25rem;
      padding: 0.375rem;
    }

    .header-logo {
      height: 24px;
    }

    .app-title {
      font-size: 1.1rem;
    }

    .main-content {
      padding: 0.75rem;
    }

    .order-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .order-date {
      font-size: 0.6875rem;
    }

    .items-summary {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
