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

    <main class="orders-main">
      <!-- Loading State -->
      <div v-if="loading" class="feedback-state">
        <div class="spinner"></div>
        <p class="text-gray-500">Cargando pedidos...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="feedback-state">
        <div class="state-icon-wrap gradient-danger">
          <i class="pi pi-exclamation-triangle text-white"></i>
        </div>
        <h2 class="text-gray-800">Error</h2>
        <p class="text-gray-500">{{ error }}</p>
        <button @click="fetchOrders" class="btn-primary retry-btn">
          <i class="pi pi-refresh"></i>
          Intentar de nuevo
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="orders.length === 0" class="feedback-state">
        <div class="state-icon-wrap gradient-primary">
          <i class="pi pi-box text-white"></i>
        </div>
        <h2 class="text-gray-800">Sin pedidos</h2>
        <p class="text-gray-500">Aun no tienes pedidos realizados</p>
      </div>

      <!-- Orders List -->
      <div v-else class="orders-list">
        <div
          v-for="order in orders"
          :key="order.id"
          class="order-card card-modern hover-lift"
          @click="goToOrder(order.id)"
          role="button"
          tabindex="0"
          @keydown.enter="goToOrder(order.id)"
        >
          <div class="order-header">
            <span :class="['status-badge', getStatusClass(order.status)]">
              {{ StatusIcons[order.status] }} {{ StatusLabels[order.status] }}
            </span>
            <span class="order-date text-gray-500">{{ formatDate(order.created_at) }}</span>
          </div>

          <div class="order-body">
            <div class="order-info">
              <div class="order-meta-item">
                <span class="meta-label text-gray-400">Pedido</span>
                <span class="meta-value text-gray-800">#{{ order.id.slice(0, 8) }}</span>
              </div>
              <div v-if="order.eta" class="order-meta-item">
                <span class="meta-label text-gray-400">ETA</span>
                <span class="meta-value text-gray-800">{{ order.eta }}</span>
              </div>
            </div>

            <div v-if="order.data?.items" class="order-items">
              <div class="items-summary">
                <span class="items-count text-gray-500">
                  {{ order.data.items.length }} producto(s)
                </span>
                <span class="items-total text-primary">
                  {{ formatPrice(calculateOrderTotal(order.data)) }}
                </span>
              </div>
              <p class="items-preview text-gray-400">
                <span
                  v-for="(item, index) in order.data.items.slice(0, 3)"
                  :key="index"
                >{{ item.name }}<span v-if="index < Math.min(order.data.items.length, 3) - 1">, </span></span>
                <em v-if="order.data.items.length > 3"> y {{ order.data.items.length - 3 }} mas...</em>
              </p>
            </div>
          </div>

          <div class="order-footer">
            <span class="view-details text-primary">Ver detalle &rarr;</span>
          </div>
        </div>
      </div>
    </main>

    <footer class="app-footer">
      <img :src="yegoLogo" alt="Yego" class="footer-logo" />
      <p class="text-gray-400">Powered by Gillie AI</p>
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

  /* Main content */
  .orders-main {
    flex: 1;
    padding: var(--spacing-lg) var(--spacing-md);
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
  }

  /* Feedback states */
  .feedback-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-md);
    text-align: center;
    gap: var(--spacing-sm);
  }

  .feedback-state h2 {
    font-size: 1.25rem;
    font-weight: var(--font-semibold);
  }

  .state-icon-wrap {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    margin-bottom: var(--spacing-xs);
  }

  /* Spinner */
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Retry button */
  .retry-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--radius-md);
    margin-top: var(--spacing-xs);
  }

  /* Orders list */
  .orders-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  /* Order card */
  .order-card {
    padding: var(--spacing-md);
    cursor: pointer;
    animation: fadeUp var(--transition-normal) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Order header */
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }

  .order-date {
    font-size: 0.75rem;
  }

  /* Status badges */
  .status-badge {
    font-size: 0.75rem;
    font-weight: var(--font-semibold);
    padding: 0.25rem var(--spacing-sm);
    border-radius: var(--radius-xl);
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .status-delivered {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success-dark);
  }

  .status-cancelled {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger-dark);
  }

  .status-paused {
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning-dark);
  }

  .status-on-way {
    background: color-mix(in srgb, var(--color-info) 15%, transparent);
    color: var(--color-info-dark);
  }

  .status-pending {
    background: var(--vt-c-gray-100);
    color: var(--vt-c-gray-700);
  }

  /* Order body */
  .order-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .order-info {
    display: flex;
    gap: var(--spacing-lg);
  }

  .order-meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .meta-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: var(--font-medium);
  }

  .meta-value {
    font-size: 0.875rem;
    font-weight: var(--font-semibold);
  }

  /* Order items */
  .order-items {
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border-light);
  }

  .items-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.375rem;
  }

  .items-count {
    font-size: 0.8125rem;
  }

  .items-total {
    font-size: 1rem;
    font-weight: var(--font-bold);
  }

  .items-preview {
    font-size: 0.75rem;
    line-height: 1.5;
    margin: 0;
  }

  /* Order footer */
  .order-footer {
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border-light);
    text-align: right;
  }

  .view-details {
    font-size: 0.8125rem;
    font-weight: var(--font-semibold);
  }

  /* Footer */
  .app-footer {
    background: var(--surface-card);
    padding: var(--spacing-md);
    text-align: center;
    border-top: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .footer-logo {
    height: 24px;
    width: auto;
    opacity: 0.6;
  }

  .app-footer p {
    font-size: 0.8125rem;
    margin: 0;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .orders-main {
      padding: var(--spacing-md) var(--spacing-sm);
    }

    .order-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-xs);
    }

    .items-summary {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
