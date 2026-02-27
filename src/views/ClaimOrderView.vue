<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { orderService } from "../api/orderService";
  import type { ClaimOrderResponse } from "../types/order";
  import { StatusLabels, StatusIcons } from "../types/order";
  import Button from "primevue/button";

  const route = useRoute();
  const router = useRouter();

  const token = route.params.token as string;

  const loading = ref(true);
  const claiming = ref(false);
  const error = ref<string | null>(null);
  const claimedOrder = ref<ClaimOrderResponse | null>(null);

  const claimOrder = async () => {
    claiming.value = true;
    error.value = null;

    try {
      const response = await orderService.claimOrder(token);
      claimedOrder.value = response;
      setTimeout(() => router.push(`/order/${response.order_id}`), 3000);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { code?: string; message?: string } };
      };
      const errorCode = axiosError.response?.data?.code;

      if (errorCode === "order:token:expired") {
        error.value = "El enlace ha expirado. Por favor, solicita uno nuevo.";
      } else if (errorCode === "order:token:not-found") {
        error.value = "Enlace invalido. Verifica que el enlace sea correcto.";
      } else {
        error.value =
          axiosError.response?.data?.message ||
          "Error al reclamar la orden. Intenta nuevamente.";
      }
    } finally {
      claiming.value = false;
    }
  };

  const goToOrder = () => {
    if (claimedOrder.value) {
      router.push(`/order/${claimedOrder.value.order_id}`);
    }
  };

  const goToProfile = () => {
    router.push("/profile");
  };

  onMounted(async () => {
    loading.value = true;
    try {
      // Check if already claimed - redirect immediately
      const claimInfo = await orderService.getClaimInfo(token);
      if (claimInfo.is_claimed) {
        router.push(`/order/${claimInfo.order_id}`);
        return;
      }
    } catch (err) {
      // Token might be invalid, let the claim attempt handle the error
    } finally {
      loading.value = false;
    }
  });
</script>

<template>
  <div class="claim-container gradient-background">
    <div class="claim-background" aria-hidden="true">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <div class="claim-content">
      <header class="claim-header">
        <div class="logo-icon gradient-primary">
          <span class="text-white">W</span>
        </div>
        <h1 class="logo-text">Yego</h1>
      </header>

      <div class="claim-card">
        <!-- Loading State -->
        <div v-if="loading" class="state-container">
          <div class="state-icon gradient-primary">
            <div class="spinner"></div>
          </div>
          <h2 class="state-title text-gray-800">Cargando...</h2>
          <p class="state-description text-gray-500">Estamos preparando tu orden...</p>
        </div>

        <!-- Claim Form -->
        <div v-else-if="!claimedOrder" class="state-container">
          <div class="state-icon gradient-primary">
            <i class="pi pi-shopping-bag text-white"></i>
          </div>
          <h2 class="state-title text-gray-800">Reclamar Pedido</h2>
          <p class="state-description text-gray-500">
            Al reclamar este pedido quedara asociado a tu cuenta y podras
            realizar el pago.
          </p>

          <div v-if="error" class="alert-danger">
            <i class="pi pi-exclamation-triangle"></i>
            {{ error }}
          </div>

          <Button
            label="Reclamar Pedido"
            @click="claimOrder"
            :loading="claiming"
            class="claim-button"
          />
        </div>

        <!-- Success State -->
        <div v-else class="state-container">
          <div class="state-icon gradient-success">
            <i class="pi pi-check-circle text-white"></i>
          </div>
          <h2 class="state-title text-gray-800">Pedido Reclamado!</h2>
          <p class="state-description text-gray-500">
            Tu pedido ha sido asociado a tu cuenta. Ahora podes realizar el pago
            desde la vista del pedido.
          </p>

          <div class="order-details">
            <div class="detail-row">
              <span class="detail-label text-gray-500">ID de Orden</span>
              <span class="detail-value text-gray-800">
                {{ claimedOrder.order_id.slice(0, 8) }}...
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label text-gray-500">Estado</span>
              <span class="status-chip gradient-primary">
                <i :class="['pi', StatusIcons[claimedOrder.status] || 'pi-box']"></i>
                {{ StatusLabels[claimedOrder.status] }}
              </span>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn-primary action-btn" @click="goToOrder">
              Ver y Pagar Pedido
            </button>
            <button class="btn-secondary action-btn" @click="goToProfile">
              Ir a Mi Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* Layout */
  .claim-container {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  /* Animated background shapes */
  .claim-background {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .shape {
    position: absolute;
    background: var(--bg-transparent);
    border-radius: 50%;
    animation: float 6s ease-in-out infinite;
  }

  .shape-1 {
    width: 300px;
    height: 300px;
    top: -100px;
    left: -100px;
    animation-delay: 0s;
  }

  .shape-2 {
    width: 200px;
    height: 200px;
    bottom: -50px;
    right: -50px;
    animation-delay: 3s;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-20px) rotate(10deg); }
  }

  /* Content wrapper */
  .claim-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 480px;
    padding: var(--spacing-xl);
  }

  /* Header / logo */
  .claim-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xl);
  }

  .logo-icon {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 32px var(--shadow-heavy);
  }

  .logo-icon span {
    font-size: 1.75rem;
    font-weight: var(--font-bold);
  }

  .logo-text {
    font-size: 2rem;
    font-weight: var(--font-bold);
    color: var(--color-text-white);
    margin: 0;
    text-shadow: 0 2px 10px var(--shadow-heavy);
  }

  /* Card */
  .claim-card {
    background: var(--surface-card);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xl);
    box-shadow: 0 25px 50px var(--shadow-heavy);
    animation: slideUp var(--transition-slow) ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* State containers */
  .state-container {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .state-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    margin-bottom: var(--spacing-xs);
  }

  /* Spinner inside state-icon */
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-white);
    border-top-color: var(--color-text-white);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .state-title {
    font-size: 1.5rem;
    font-weight: var(--font-semibold);
    margin: 0;
  }

  .state-description {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    max-width: 34ch;
  }

  /* Error alert */
  .alert-danger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: 0.875rem;
    color: var(--color-danger-dark);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
    border-radius: var(--radius-md);
  }

  /* Claim button — full-width override of btn-primary */
  .claim-button {
    width: 100% !important;
    margin-top: var(--spacing-xs);
  }

  /* Order details */
  .order-details {
    width: 100%;
    background: var(--bg-light);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-top: var(--spacing-xs);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) 0;
  }

  .detail-row:not(:last-child) {
    border-bottom: 1px solid var(--border-light);
  }

  .detail-label {
    font-size: 0.875rem;
  }

  .detail-value {
    font-weight: var(--font-semibold);
    font-size: 0.875rem;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem var(--spacing-sm);
    border-radius: var(--radius-xl);
    font-size: 0.8125rem;
    font-weight: var(--font-semibold);
    color: var(--color-text-white);
  }

  /* Action buttons */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    width: 100%;
    margin-top: var(--spacing-xs);
  }

  .action-btn {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .claim-content {
      padding: var(--spacing-md);
    }

    .claim-card {
      padding: var(--spacing-lg);
    }

    .logo-text {
      font-size: 1.5rem;
    }
  }
</style>
