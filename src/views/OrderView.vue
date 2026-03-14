<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { orderService } from "../api/orderService";
  import { profileService } from "../api/profileService";
  import { authService } from "../api/authService";
  import { settingsService } from "../api/settingsService";
  import { paymentMethodService } from "../api/paymentMethodService";
  import type { Order } from "../types/order";
  import { calculateOrderTotal, formatPrice } from "../types/order";
  import type { Profile } from "../types/profile";
  import type { PaymentMethod } from "../types/payment";
  import type { DeliveryFeeResult } from "../types/settings";
  import { isAdmin } from "../types/auth";
  import OrderHeader from "../components/OrderHeader.vue";
  import OrderTimeline from "../components/OrderTimeline.vue";
  import OrderItemsModal from "../components/OrderItemsModal.vue";
  import yegoLogo from "../assets/img/yego-logo.png";
  import { AppHeader } from "@/components/ui";

  const route = useRoute();
  const router = useRouter();
  const order = ref<Order | null>(null);
  const profile = ref<Profile | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const showItemsModal = ref(false);
  const currentUserId = ref<string | null>(null);
  const isUserAdmin = ref(false);
  const markingDelivered = ref(false);
  const deliveryFee = ref<DeliveryFeeResult | null>(null);
  const calculatingDelivery = ref(false);

  // Location reminder banner (per-order dismissal)
  const showLocationReminder = ref(false);

  const locationReminderKey = computed(
    () => `yego_location_reminder_${order.value?.id}`,
  );

  watch(
    () => order.value?.id,
    (orderId) => {
      if (orderId) {
        showLocationReminder.value =
          localStorage.getItem(`yego_location_reminder_${orderId}`) !==
          "dismissed";
      }
    },
    { immediate: true },
  );

  const dismissLocationReminder = () => {
    showLocationReminder.value = false;
    localStorage.setItem(locationReminderKey.value, "dismissed");
  };

  // Payment form state
  const showPaymentModal = ref(false);
  const paymentTab = ref<"card" | "link">("card");
  const paymentMethods = ref<PaymentMethod[]>([]);
  const selectedPaymentMethod = ref<PaymentMethod | null>(null);
  const cvv = ref("");
  const processingPayment = ref(false);
  const paymentError = ref<string | null>(null);
  const locationError = ref<string | null>(null);
  const generatingLink = ref(false);
  const paymentLinkError = ref<string | null>(null);

  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Check if the current user is the one who claimed this order
  const isOrderOwner = computed(() => {
    if (!currentUserId.value || !order.value) return false;
    return order.value.user_id === currentUserId.value;
  });

  // Keep isProfileOwner for backward compat (edit profile button on profile page)
  const isProfileOwner = computed(() => isOrderOwner.value);

  // Check if profile can be edited: only before payment (CREATED status)
  const canEditProfile = computed(() => {
    if (!order.value) return false;
    if (!isOrderOwner.value) return false;
    return order.value.status === "CREATED";
  });

  // Check if order has items data
  const hasOrderItems = computed(() => {
    return order.value?.data?.items && order.value.data.items.length > 0;
  });

  // Check if user can edit order items (only admin)
  const canEditItems = computed(() => {
    return isUserAdmin.value;
  });

  // Check if user can request modification (profile owner AND only before payment)
  const canRequestModification = computed(() => {
    if (!isOrderOwner.value || !order.value) return false;
    if (isUserAdmin.value) return false;
    return order.value.status === "CREATED";
  });

  // Calculate order total
  const orderTotal = computed(() => {
    return calculateOrderTotal(order.value?.data);
  });

  // Check if there are items with pending price
  const hasPendingPrices = computed(() => {
    return order.value?.data?.items?.some((item) => item.price === 0) ?? false;
  });

  // Calculate grand total (products + delivery)
  const grandTotal = computed(() => {
    const productsTotal = orderTotal.value;
    const deliveryTotal = deliveryFee.value?.total_price || 0;
    return productsTotal + deliveryTotal;
  });

  // Calculate delivery fee
  const calculateDeliveryFee = async () => {
    if (!profile.value?.location || !order.value?.data?.items) {
      deliveryFee.value = null;
      return;
    }

    calculatingDelivery.value = true;
    try {
      const items = order.value.data.items.map((item) => ({
        quantity: item.quantity,
        weight: item.weight,
      }));

      deliveryFee.value = await settingsService.calculateDeliveryFee({
        user_latitude: profile.value.location.latitude,
        user_longitude: profile.value.location.longitude,
        items,
      });
    } catch (err) {
      console.error("Error calculating delivery fee:", err);
      deliveryFee.value = null;
    } finally {
      calculatingDelivery.value = false;
    }
  };

  const fetchOrder = async () => {
    try {
      const id = route.params.id as string;
      order.value = await orderService.getOrder(id);
      lastUpdated.value = new Date();
      error.value = null;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message || "No se pudo cargar el pedido";
      order.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchProfile = async (profileId: string) => {
    try {
      profile.value = await profileService.getProfile(profileId);
    } catch (err: unknown) {
      console.error("Error fetching profile:", err);
      profile.value = null;
    }
  };

  // Fetch profile when order is loaded
  watch(
    () => order.value,
    async (newOrder) => {
      if (!newOrder) return;
      if (newOrder.profile_id) {
        fetchProfile(newOrder.profile_id);
      } else if (newOrder.status === "CREATED" && isOrderOwner.value) {
        // Order has no profile assigned yet — try to find user's own profile
        try {
          const profileCheck = await profileService.checkCompleted();
          if (profileCheck.profile_id) {
            fetchProfile(profileCheck.profile_id);
          }
        } catch {
          // ignore
        }
      }
    },
    { immediate: true },
  );

  // Calculate delivery fee when profile and order data are available
  watch(
    [() => profile.value?.location, () => order.value?.data?.items],
    () => {
      calculateDeliveryFee();
    },
    { immediate: true },
  );

  const refresh = async () => {
    await fetchOrder();
  };

  const editProfile = () => {
    const profileId = order.value?.profile_id || profile.value?.id;
    if (profileId) {
      router.push(`/edit-profile/${profileId}`);
    }
  };

  // Get current user ID from JWT token
  const getCurrentUserId = (): string | null => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      // Decode JWT payload (base64)
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = parts[1] as string;
      const decoded = JSON.parse(atob(payload));
      return decoded.user_id || null;
    } catch {
      return null;
    }
  };

  // Check if admin can mark order as delivered
  const canMarkDelivered = computed(() => {
    if (!isUserAdmin.value || !order.value) return false;
    return (
      order.value.status !== "DELIVERED" && order.value.status !== "CANCELLED"
    );
  });

  // Check if current user can pay (profile owner + status CREATED + no pending prices)
  const canPay = computed(() => {
    if (!isOrderOwner.value || !order.value) return false;
    if (isUserAdmin.value) return false;
    if (hasPendingPrices.value) return false;
    return order.value.status === "CREATED";
  });

  const closePaymentModal = async () => {
    showPaymentModal.value = false;
    await fetchOrder();
  };

  const openPaymentModal = async () => {
    try {
      const profileCheck = await profileService.checkCompleted();
      console.log("[ProfileCheck][openPaymentModal] result:", profileCheck);
      if (!profileCheck.is_completed) {
        console.log(
          "[ProfileCheck][openPaymentModal] profile incomplete, redirecting",
        );
        locationError.value =
          "Completá tu perfil de entrega antes de pagar. Redirigiendo...";
        setTimeout(() => {
          if (profileCheck.profile_id) {
            router.push(
              `/edit-profile/${profileCheck.profile_id}?returnTo=/order/${order.value?.id}`,
            );
          } else {
            router.push(`/profile?returnTo=/order/${order.value?.id}`);
          }
        }, 3000);
        return;
      }
    } catch (e) {
      console.error("[ProfileCheck][openPaymentModal] error:", e);
      // si falla el check, continuar con la verificación local
      if (!profile.value?.location) {
        locationError.value = "Completá tu perfil de entrega antes de pagar.";
        return;
      }
    }
    locationError.value = null;

    paymentError.value = null;
    paymentLinkError.value = null;
    cvv.value = "";
    selectedPaymentMethod.value = null;
    try {
      const methods = await paymentMethodService.getPaymentMethods();
      paymentMethods.value = methods;
      const defaultMethod = methods.find((m) => m.is_default);
      selectedPaymentMethod.value = defaultMethod || methods[0] || null;
    } catch (err) {
      console.error("Error fetching payment methods:", err);
      paymentMethods.value = [];
    }
    paymentTab.value = "card";
    showPaymentModal.value = true;
  };

  const openPaymentLink = async () => {
    if (!order.value) return;
    generatingLink.value = true;
    paymentLinkError.value = null;
    try {
      const result = await orderService.createPaymentLink(order.value.id);
      window.open(result.init_point, "_blank");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      paymentLinkError.value =
        axiosError.response?.data?.message ||
        "Error al generar el link de pago.";
    } finally {
      generatingLink.value = false;
    }
  };

  const processPayment = async () => {
    if (!order.value || !cvv.value || !selectedPaymentMethod.value) return;

    if (cvv.value.length < 3 || cvv.value.length > 4) {
      paymentError.value = "El CVV debe tener 3 o 4 dígitos";
      return;
    }

    processingPayment.value = true;
    paymentError.value = null;

    try {
      await orderService.payForOrder(order.value.id, cvv.value);
      showPaymentModal.value = false;
      await fetchOrder();
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { code?: string; message?: string } };
      };
      const errorCode = axiosError.response?.data?.code;
      if (errorCode === "order:payment-failed") {
        paymentError.value =
          "El pago falló. Verificá tu CVV e intentá nuevamente.";
      } else {
        paymentError.value =
          axiosError.response?.data?.message || "Error al procesar el pago.";
      }
    } finally {
      processingPayment.value = false;
    }
  };

  // Check if order is delivered (all dots should be green)
  const isDelivered = computed(() => {
    return order.value?.status === "DELIVERED";
  });

  // Check admin status - only if authenticated
  const checkAdminStatus = async () => {
    if (!authService.isAuthenticated()) {
      isUserAdmin.value = false;
      return;
    }
    try {
      const response = await authService.me();
      isUserAdmin.value = isAdmin(response.data);
    } catch {
      isUserAdmin.value = false;
    }
  };

  // Mark order as delivered
  const markAsDelivered = async () => {
    if (!order.value || markingDelivered.value) return;

    markingDelivered.value = true;
    try {
      await orderService.updateStatus(order.value.id, { status: "DELIVERED" });
      await fetchOrder();
    } catch (err) {
      console.error("Error marking order as delivered:", err);
    } finally {
      markingDelivered.value = false;
    }
  };

  // Handle order data update from modal
  const handleOrderDataUpdated = async () => {
    await fetchOrder();
    showItemsModal.value = false;
  };

  // Handle modification request from modal
  const handleModificationRequested = async () => {
    await fetchOrder();
    showItemsModal.value = false;
  };

  // Si el usuario está autenticado y el perfil está incompleto, redirigir a editar perfil
  watch(
    () => order.value?.user_id,
    async (userId) => {
      console.log(
        "[ProfileCheck][watch] userId:",
        userId,
        "isAuth:",
        authService.isAuthenticated(),
      );
      if (!userId || !authService.isAuthenticated()) return;
      try {
        const profileCheck = await profileService.checkCompleted();
        console.log("[ProfileCheck][watch] result:", profileCheck);
        if (!profileCheck.is_completed) {
          console.log("[ProfileCheck][watch] redirecting to complete profile");
          if (profileCheck.profile_id) {
            router.push(
              `/edit-profile/${profileCheck.profile_id}?returnTo=/order/${route.params.id}`,
            );
          } else {
            router.push(`/profile?returnTo=/order/${route.params.id}`);
          }
        }
      } catch (e) {
        console.error("[ProfileCheck][watch] error:", e);
      }
    },
  );

  onMounted(() => {
    currentUserId.value = getCurrentUserId();
    checkAdminStatus();
    fetchOrder();
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(fetchOrder, 30000);
  });

  onUnmounted(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<template>
  <div class="order-view">
    <AppHeader title="Seguimiento de Pedido" :show-logo="true" />

    <main class="main-content">
      <!-- Loading State -->
      <div v-if="loading" class="feedback-state">
        <div class="loading-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <p class="feedback-text">Cargando pedido...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="feedback-state">
        <div class="error-icon-wrapper">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <h2 class="feedback-title">Pedido no encontrado</h2>
        <p class="feedback-subtitle">{{ error }}</p>
        <button @click="refresh" class="btn btn--primary btn--md">
          <i class="pi pi-refresh"></i>
          Intentar de nuevo
        </button>
      </div>

      <!-- Order Content -->
      <div v-else-if="order" class="order-content">
        <!-- Order Header Component -->
        <OrderHeader :order="order" />

        <!-- Pending prices block -->
        <div
          v-if="hasPendingPrices && isOrderOwner && !isUserAdmin && order.status === 'CREATED'"
          class="alert alert--pending-price"
        >
          <div class="alert__body">
            <span class="alert__icon alert__icon--warning">
              <i class="pi pi-exclamation-triangle"></i>
            </span>
            <div class="alert__text">
              <strong class="alert__title">Precios pendientes</strong>
              <p class="alert__desc">
                Algunos productos aún no tienen precio asignado. No es posible
                realizar el pago hasta que todos los precios estén confirmados.
              </p>
            </div>
          </div>
        </div>

        <!-- Pay Now Alert -->
        <div v-if="canPay" class="alert alert--pay">
          <div class="alert__body">
            <span class="alert__icon alert__icon--pay">
              <i class="pi pi-credit-card"></i>
            </span>
            <div class="alert__text">
              <strong class="alert__title">Completá el pago</strong>
              <p class="alert__desc">
                Tu pedido está listo para ser pagado. Una vez pagado pasará al
                estado "Confirmado".
              </p>
              <p v-if="locationError" class="alert__location-error">
                <i class="pi pi-exclamation-triangle"></i>
                {{ locationError }}
              </p>
            </div>
          </div>
          <button @click="openPaymentModal" class="btn btn--pay btn--sm">
            <i class="pi pi-lock"></i>
            Pagar ahora
          </button>
        </div>

        <!-- Status Message Alert (Paused / Cancelled / Modification) -->
        <div
          v-if="
            order.status_message &&
            (order.status === 'PAUSED' ||
              order.status === 'CANCELLED' ||
              order.status === 'MODIFICATION_REQUESTED')
          "
          :class="[
            'alert',
            order.status === 'PAUSED'
              ? 'alert--paused'
              : order.status === 'MODIFICATION_REQUESTED'
                ? 'alert--modification'
                : 'alert--cancelled',
          ]"
        >
          <div class="alert__body">
            <span class="alert__icon">
              <i v-if="order.status === 'PAUSED'" class="pi pi-pause"></i>
              <i
                v-else-if="order.status === 'MODIFICATION_REQUESTED'"
                class="pi pi-pencil"
              ></i>
              <i v-else class="pi pi-times-circle"></i>
            </span>
            <div class="alert__text">
              <strong class="alert__title">
                {{
                  order.status === "PAUSED"
                    ? "Tu pedido está pausado"
                    : order.status === "MODIFICATION_REQUESTED"
                      ? "Modificación solicitada"
                      : "Tu pedido ha sido cancelado"
                }}
              </strong>
              <p class="alert__desc">{{ order.status_message }}</p>
            </div>
          </div>
          <button
            v-if="order.status === 'PAUSED' && canEditProfile"
            @click="editProfile"
            class="btn btn--outline btn--sm"
          >
            Editar perfil
          </button>
        </div>

        <!-- Timeline -->
        <OrderTimeline :order="order" :all-completed="isDelivered" />

        <!-- Order Summary Card -->
        <div v-if="hasOrderItems" class="card">
          <div class="card__header">
            <div class="card__header-left">
              <span class="card__icon card__icon--indigo">
                <i class="pi pi-shopping-bag"></i>
              </span>
              <h3 class="card__title">Resumen del pedido</h3>
            </div>
            <button
              class="btn btn--ghost btn--sm"
              @click="showItemsModal = true"
            >
              <i :class="canRequestModification ? 'pi pi-pencil' : 'pi pi-list'"></i>
              {{ canRequestModification ? 'Modificar' : 'Ver detalle' }}
            </button>
          </div>

          <div class="summary-rows">
            <!-- Item breakdown -->
            <div
              v-for="(item, index) in order.data!.items"
              :key="index"
              class="summary-row summary-row--item"
            >
              <span class="summary-row__label">
                {{ item.name }}
                <span class="summary-row__badge">x{{ item.quantity }}</span>
              </span>
              <span v-if="item.price > 0" class="summary-row__value summary-row__value--item">
                {{ formatPrice(item.price * item.quantity) }}
              </span>
              <span v-else class="summary-row__value summary-row__value--muted">Pendiente</span>
            </div>

            <!-- Subtotal -->
            <div class="summary-row summary-row--subtotal">
              <span class="summary-row__label">Subtotal</span>
              <span class="summary-row__value">{{ formatPrice(orderTotal) }}</span>
            </div>

            <div class="summary-row">
              <span class="summary-row__label">Envío</span>
              <span
                class="summary-row__value summary-row__value--muted"
                v-if="calculatingDelivery"
              >
                <span class="inline-spinner"></span>
                Calculando...
              </span>
              <span
                class="summary-row__value summary-row__value--muted"
                v-else-if="!profile?.location"
              >
                Pendiente ubicación
              </span>
              <span class="summary-row__value" v-else-if="deliveryFee">
                {{ formatPrice(deliveryFee.total_price) }}
              </span>
              <span class="summary-row__value summary-row__value--muted" v-else
                >--</span
              >
            </div>

            <div class="summary-row summary-row--total">
              <span class="summary-row__label">Total</span>
              <span class="summary-row__value summary-row__value--total">
                {{ formatPrice(grandTotal) }}
              </span>
            </div>

            <div v-if="hasPendingPrices" class="pending-notice">
              <i class="pi pi-clock"></i>
              Estamos buscando el mejor precio para algunos productos...
            </div>
          </div>
        </div>

        <!-- Location Reminder Banner -->
        <div v-if="canPay && showLocationReminder" class="location-banner">
          <div class="location-banner__content">
            <i class="pi pi-map-marker location-banner__icon"></i>
            <span
              >Recordá verificar tu dirección de entrega antes de realizar el
              pago.</span
            >
          </div>
          <button
            class="location-banner__close"
            @click="dismissLocationReminder"
            title="Cerrar"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Delivery Info Card -->
        <div v-if="profile" class="card">
          <div class="card__header">
            <div class="card__header-left">
              <span class="card__icon card__icon--green">
                <i class="pi pi-map-marker"></i>
              </span>
              <h3 class="card__title">Entrega en</h3>
            </div>
            <div
              v-if="isProfileOwner"
              :title="
                !canEditProfile
                  ? 'Los datos de entrega solo se pueden modificar antes de realizar el pago'
                  : ''
              "
            >
              <button
                @click="canEditProfile && editProfile()"
                class="btn btn--ghost btn--sm"
                :class="{ 'btn--disabled': !canEditProfile }"
                :disabled="!canEditProfile"
              >
                <i class="pi pi-pencil"></i>
                Cambiar datos
              </button>
            </div>
          </div>

          <div class="delivery-details">
            <div class="delivery-details__row">
              <i class="pi pi-map-marker delivery-details__icon"></i>
              <span class="delivery-details__text">
                {{ profile.location?.address || "Sin dirección" }}
              </span>
            </div>
            <div class="delivery-details__row">
              <i class="pi pi-phone delivery-details__icon"></i>
              <span class="delivery-details__text">{{
                profile.phone_number
              }}</span>
            </div>
          </div>
        </div>

        <!-- Actions Section -->
        <div class="actions-section">
          <div class="actions-section__buttons">
            <button @click="refresh" class="btn btn--outline btn--md">
              <i class="pi pi-refresh"></i>
              Actualizar estado
            </button>
            <button
              v-if="canMarkDelivered"
              @click="markAsDelivered"
              :disabled="markingDelivered"
              class="btn btn--delivered btn--md"
              :class="{ 'btn--loading': markingDelivered }"
            >
              <span
                v-if="markingDelivered"
                class="inline-spinner inline-spinner--white"
              ></span>
              <i v-else class="pi pi-check-circle"></i>
              {{ markingDelivered ? "Marcando..." : "Marcar entregado" }}
            </button>
          </div>
          <p v-if="lastUpdated" class="actions-section__timestamp">
            <i class="pi pi-clock"></i>
            Actualizado a las {{ lastUpdated.toLocaleTimeString("es-ES") }}
          </p>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <img :src="yegoLogo" alt="Yego" class="app-footer__logo" />
      <p class="app-footer__text">Powered by Gillie AI</p>
    </footer>

    <!-- Order Items Modal -->
    <OrderItemsModal
      v-if="order?.data"
      :data="order.data"
      :show="showItemsModal"
      :is-admin="canEditItems"
      :can-request-modification="canRequestModification"
      :edit-mode="canRequestModification"
      :order-id="order.id"
      @close="showItemsModal = false"
      @updated="handleOrderDataUpdated"
      @modification-requested="handleModificationRequested"
    />

    <!-- Payment Modal -->
    <div
      v-if="showPaymentModal"
      class="modal-overlay"
      @click.self="closePaymentModal"
    >
      <div class="payment-modal">
        <div class="payment-modal__header">
          <div class="payment-modal__title-group">
            <span class="payment-modal__title-icon">
              <i class="pi pi-credit-card"></i>
            </span>
            <h2 class="payment-modal__title">Pagar Pedido</h2>
          </div>
          <button class="modal-close-btn" @click="closePaymentModal">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- No saved cards: two options -->
        <div v-if="paymentMethods.length === 0" class="no-cards-options">
          <div
            class="no-cards-option"
            @click="
              router.push('/payment-methods');
              showPaymentModal = false;
            "
          >
            <span class="no-cards-option__icon">
              <i class="pi pi-credit-card"></i>
            </span>
            <div class="no-cards-option__text">
              <strong>Configurar tarjeta</strong>
              <span>Pagá con tu tarjeta guardada</span>
            </div>
            <i class="pi pi-chevron-right no-cards-option__arrow"></i>
          </div>

          <div class="no-cards-divider">
            <span>o</span>
          </div>

          <div class="no-cards-option" @click="openPaymentLink">
            <span class="no-cards-option__icon">
              <i class="pi pi-external-link"></i>
            </span>
            <div class="no-cards-option__text">
              <strong>Link de pago</strong>
              <span>Pagá a través de MercadoPago</span>
            </div>
            <i
              v-if="!generatingLink"
              class="pi pi-chevron-right no-cards-option__arrow"
            ></i>
            <span v-else class="generating-text">Generando...</span>
          </div>

          <div v-if="paymentLinkError" class="payment-error">
            <i class="pi pi-exclamation-triangle"></i>
            {{ paymentLinkError }}
          </div>
        </div>

        <!-- Payment Tabs (cards exist) -->
        <template v-else>
          <div class="payment-tabs">
            <button
              class="payment-tab"
              :class="{ 'payment-tab--active': paymentTab === 'card' }"
              @click="paymentTab = 'card'"
            >
              <i class="pi pi-credit-card"></i>
              Con tarjeta
            </button>
            <button
              class="payment-tab"
              :class="{ 'payment-tab--active': paymentTab === 'link' }"
              @click="paymentTab = 'link'"
            >
              <i class="pi pi-external-link"></i>
              Link de pago
            </button>
          </div>

          <!-- Tab: Card Payment -->
          <div v-if="paymentTab === 'card'" class="payment-form">
            <div class="form-field">
              <label class="form-field__label">Seleccionar tarjeta</label>
              <div class="card-options">
                <label
                  v-for="method in paymentMethods"
                  :key="method.id"
                  class="card-option"
                  :class="{
                    'card-option--selected':
                      selectedPaymentMethod?.id === method.id,
                  }"
                >
                  <input
                    type="radio"
                    :value="method"
                    v-model="selectedPaymentMethod"
                    style="display: none"
                  />
                  <span class="card-option__icon">
                    <i class="pi pi-credit-card"></i>
                  </span>
                  <span class="card-option__number"
                    >•••• {{ method.last_four_digits }}</span
                  >
                  <small class="card-option__holder">{{
                    method.cardholder_name
                  }}</small>
                  <span
                    v-if="selectedPaymentMethod?.id === method.id"
                    class="card-option__check"
                  >
                    <i class="pi pi-check"></i>
                  </span>
                </label>
              </div>
            </div>

            <div class="form-field">
              <label class="form-field__label" for="order-cvv">
                CVV
                <span class="form-field__required">*</span>
              </label>
              <input
                id="order-cvv"
                v-model="cvv"
                type="password"
                placeholder="123"
                maxlength="4"
                class="form-field__input"
                :disabled="processingPayment"
              />
            </div>

            <div v-if="paymentError" class="payment-error">
              <i class="pi pi-exclamation-triangle"></i>
              {{ paymentError }}
            </div>

            <div class="payment-modal__actions">
              <button
                class="btn btn--outline btn--md"
                @click="closePaymentModal"
                :disabled="processingPayment"
              >
                Cancelar
              </button>
              <button
                class="btn btn--pay btn--md btn--flex2"
                @click="processPayment"
                :disabled="!cvv || !selectedPaymentMethod || processingPayment"
                :class="{ 'btn--loading': processingPayment }"
              >
                <span
                  v-if="processingPayment"
                  class="inline-spinner inline-spinner--white"
                ></span>
                <i v-else class="pi pi-lock"></i>
                {{ processingPayment ? "Procesando..." : "Confirmar Pago" }}
              </button>
            </div>
          </div>

          <!-- Tab: Payment Link -->
          <div v-else-if="paymentTab === 'link'" class="payment-link-section">
            <div class="payment-link-info">
              <span class="payment-link-info__icon">
                <i class="pi pi-external-link"></i>
              </span>
              <p class="payment-link-info__desc">
                Se abrirá una página de MercadoPago donde podrás completar el
                pago de forma segura.
              </p>
              <p class="payment-link-info__note">
                Una vez completado el pago, tu pedido pasará a estado
                "Confirmado" automáticamente.
              </p>
            </div>

            <div v-if="paymentLinkError" class="payment-error">
              <i class="pi pi-exclamation-triangle"></i>
              {{ paymentLinkError }}
            </div>

            <div class="payment-modal__actions">
              <button
                class="btn btn--outline btn--md"
                @click="closePaymentModal"
                :disabled="generatingLink"
              >
                Cancelar
              </button>
              <button
                class="btn btn--pay btn--md btn--flex2"
                @click="openPaymentLink"
                :disabled="generatingLink"
                :class="{ 'btn--loading': generatingLink }"
              >
                <span
                  v-if="generatingLink"
                  class="inline-spinner inline-spinner--white"
                ></span>
                <i v-else class="pi pi-external-link"></i>
                {{ generatingLink ? "Generando..." : "Ir a pagar" }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* =============================================
   PAGE SHELL
   ============================================= */
  .order-view {
    --_accent: #6366f1; /* indigo-500 — no global alias exists */
    --_accent-dark: #4f46e5; /* indigo-600 */
    --_accent-bg: #eef2ff; /* indigo-50  */
    --_accent-bg-md: #e0e7ff; /* indigo-100 */
    --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08);
    --shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.18);
    --radius-card: 0.75rem;
    --radius-btn: 0.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--vt-c-gray-100);
  }

  .main-content {
    flex: 1;
    padding: 1.25rem 1rem 2rem;
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
  }

  @media (max-width: 480px) {
    .main-content {
      padding: 1rem 0.75rem 1.5rem;
    }
  }

  /* =============================================
   FEEDBACK STATES (Loading / Error)
   ============================================= */
  .feedback-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    gap: 1rem;
  }

  .loading-ring {
    display: inline-block;
    position: relative;
    width: 52px;
    height: 52px;
  }

  .loading-ring div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: 42px;
    height: 42px;
    margin: 5px;
    border: 4px solid var(--_accent);
    border-radius: 50%;
    animation: loading-ring-spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: var(--_accent) transparent transparent transparent;
  }

  .loading-ring div:nth-child(1) {
    animation-delay: -0.45s;
  }
  .loading-ring div:nth-child(2) {
    animation-delay: -0.3s;
  }
  .loading-ring div:nth-child(3) {
    animation-delay: -0.15s;
  }

  @keyframes loading-ring-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .feedback-text {
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .error-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    border: 2px solid var(--vt-c-danger-lighter);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    color: var(--color-danger);
  }

  .feedback-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--vt-c-gray-900);
    margin: 0;
  }

  .feedback-subtitle {
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  /* =============================================
   ORDER CONTENT ANIMATION
   ============================================= */
  .order-content {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    animation: content-enter 0.3s ease both;
  }

  @keyframes content-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* =============================================
   CARD BASE
   ============================================= */
  .card {
    background: var(--surface-card);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-card);
    border: 1px solid var(--border-light);
    overflow: hidden;
  }

  .card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--vt-c-gray-100);
  }

  .card__header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .card__icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .card__icon--indigo {
    background: var(--_accent-bg);
    color: var(--_accent);
  }

  .card__icon--green {
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    color: var(--color-success);
  }

  .card__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--vt-c-gray-900);
    margin: 0;
  }

  /* =============================================
   ALERT BANNERS
   ============================================= */
  .alert {
    border-radius: var(--radius-card);
    border: 1px solid transparent;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    box-shadow: var(--shadow-card);
  }

  .alert__body {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
  }

  .alert__icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .alert__text {
    flex: 1;
    min-width: 0;
  }

  .alert__title {
    display: block;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--vt-c-gray-900);
    margin-bottom: 0.25rem;
  }

  .alert__desc {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.55;
  }

  .alert__location-error {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0.375rem 0 0 0;
    font-size: 0.8125rem;
    color: var(--color-warning-dark);
    font-weight: 500;
  }

  /* Alert — pay (success/green tones) */
  .alert--pay {
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    border-color: var(--vt-c-success-lighter);
  }

  .alert--pay .alert__icon {
    background: color-mix(in srgb, var(--color-success) 18%, transparent);
    color: var(--color-success-dark);
  }

  /* Alert — pending price (orange tones) */
  .alert--pending-price {
    background: color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-warning, #f59e0b) 35%, transparent);
  }

  .alert--pending-price .alert__icon--warning {
    background: color-mix(in srgb, var(--color-warning, #f59e0b) 18%, transparent);
    color: #b45309;
  }

  /* Alert — paused (warning/amber tones) */
  .alert--paused {
    background: color-mix(in srgb, var(--color-warning) 8%, transparent);
    border-color: var(--vt-c-warning-lighter);
    border-left: 4px solid var(--color-warning);
  }

  .alert--paused .alert__icon {
    background: color-mix(in srgb, var(--color-warning) 22%, transparent);
    color: var(--color-warning-dark);
  }

  /* Alert — cancelled (danger/red tones) */
  .alert--cancelled {
    background: color-mix(in srgb, var(--color-danger) 6%, transparent);
    border-color: var(--vt-c-danger-lighter);
    border-left: 4px solid var(--color-danger);
  }

  .alert--cancelled .alert__icon {
    background: color-mix(in srgb, var(--color-danger) 16%, transparent);
    color: var(--color-danger-dark);
  }

  /* Alert — modification (orange — between warning and danger) */
  .alert--modification {
    background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-warning) 55%, transparent);
    border-left: 4px solid
      color-mix(in srgb, var(--color-warning) 80%, var(--color-danger) 20%);
  }

  .alert--modification .alert__icon {
    background: color-mix(in srgb, var(--color-warning) 30%, transparent);
    color: color-mix(
      in srgb,
      var(--color-warning-dark) 70%,
      var(--color-danger) 30%
    );
  }

  /* =============================================
   ORDER SUMMARY ROWS
   ============================================= */
  .summary-rows {
    padding: 0.875rem 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 28px;
  }

  .summary-row__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }

  .summary-row__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: var(--border-light);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 10px;
  }

  .summary-row__value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--vt-c-gray-900);
  }

  .summary-row__value--muted {
    font-weight: 400;
    color: var(--vt-c-gray-400);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .summary-row--item .summary-row__label {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .summary-row__value--item {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--vt-c-gray-700);
  }

  .summary-row--subtotal {
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-light);
  }

  .summary-row--total {
    padding-top: 0.75rem;
    margin-top: 0.25rem;
    border-top: 1px solid var(--border-light);
  }

  .summary-row--total .summary-row__label {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--vt-c-gray-900);
  }

  .summary-row__value--total {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--_accent);
  }

  .pending-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: color-mix(in srgb, var(--color-warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    color: var(--color-warning-dark);
  }

  .pending-notice i {
    color: var(--color-warning);
    flex-shrink: 0;
  }

  /* =============================================
   LOCATION REMINDER BANNER
   ============================================= */
  .location-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    background: color-mix(in srgb, var(--color-warning) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 28%, transparent);
    border-left: 4px solid var(--color-warning);
    border-radius: 10px;
    padding: 0.75rem 1rem;
  }

  .location-banner__content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-warning-dark);
    flex: 1;
    line-height: 1.4;
  }

  .location-banner__icon {
    color: var(--color-warning);
    flex-shrink: 0;
  }

  .location-banner__close {
    background: none;
    border: none;
    color: var(--color-warning-dark);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    flex-shrink: 0;
    transition: background var(--transition-fast);
    line-height: 1;
  }

  .location-banner__close:hover {
    background: color-mix(in srgb, var(--color-warning) 25%, transparent);
  }

  /* =============================================
   DELIVERY DETAILS
   ============================================= */
  .delivery-details {
    padding: 0.875rem 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .delivery-details__row {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
  }

  .delivery-details__icon {
    color: var(--vt-c-gray-400);
    font-size: 0.9rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .delivery-details__text {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.45;
  }

  /* =============================================
   ACTIONS SECTION
   ============================================= */
  .actions-section {
    padding: 0.25rem 0 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .actions-section__buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

  .actions-section__timestamp {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--vt-c-gray-400);
    margin: 0;
  }

  .actions-section__timestamp i {
    font-size: 0.8rem;
  }

  /* =============================================
   BUTTON SYSTEM
   ============================================= */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4375rem;
    border: none;
    border-radius: var(--radius-btn);
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      opacity var(--transition-fast);
    text-decoration: none;
    white-space: nowrap;
  }

  .btn--sm {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }
  .btn--md {
    padding: 0.6875rem 1.25rem;
    font-size: 0.9rem;
  }

  .btn--primary {
    background: var(--_accent);
    color: var(--color-text-white);
  }
  .btn--primary:hover:not(:disabled) {
    background: var(--_accent-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--_accent) 35%, transparent);
  }

  .btn--pay {
    background: var(--color-success);
    color: var(--color-text-white);
  }
  .btn--pay:hover:not(:disabled) {
    background: var(--color-success-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--color-success) 35%, transparent);
  }

  .btn--delivered {
    background: var(--_accent);
    color: var(--color-text-white);
  }
  .btn--delivered:hover:not(:disabled) {
    background: var(--_accent-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--_accent) 35%, transparent);
  }

  .btn--outline {
    background: var(--surface-card);
    color: var(--color-text-secondary);
    border: 1px solid var(--border-default);
  }
  .btn--outline:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--vt-c-gray-400);
  }

  .btn--ghost {
    background: var(--vt-c-gray-100);
    color: var(--color-text-secondary);
    border: 1px solid var(--border-light);
  }
  .btn--ghost:hover:not(:disabled) {
    background: var(--border-light);
  }

  .btn:disabled,
  .btn--disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .btn--loading {
    pointer-events: none;
  }

  .btn--flex2 {
    flex: 2;
  }

  .btn:active:not(:disabled) {
    transform: translateY(0) !important;
  }

  /* =============================================
   INLINE SPINNER
   ============================================= */
  .inline-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, var(--_accent) 25%, transparent);
    border-top-color: var(--_accent);
    border-radius: 50%;
    animation: loading-ring-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .inline-spinner--white {
    border-color: rgba(255, 255, 255, 0.3);
    border-top-color: var(--color-text-white);
  }

  /* =============================================
   FOOTER
   ============================================= */
  .app-footer {
    background: var(--surface-card);
    padding: 1rem 1.25rem;
    text-align: center;
    border-top: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
  }

  .app-footer__logo {
    height: 22px;
    width: auto;
    opacity: 0.6;
  }

  .app-footer__text {
    color: var(--vt-c-gray-400);
    font-size: 0.8125rem;
    margin: 0;
  }

  /* =============================================
   MODAL OVERLAY
   ============================================= */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--vt-c-gray-900) 55%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    backdrop-filter: blur(2px);
  }

  /* =============================================
   PAYMENT MODAL
   ============================================= */
  .payment-modal {
    background: var(--surface-card);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-modal);
    animation: modal-enter 0.25s ease both;
  }

  @keyframes modal-enter {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .payment-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem 1rem;
    border-bottom: 1px solid var(--vt-c-gray-100);
  }

  .payment-modal__title-group {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .payment-modal__title-icon {
    width: 34px;
    height: 34px;
    background: var(--_accent-bg);
    color: var(--_accent);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
  }

  .payment-modal__title {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--vt-c-gray-900);
    margin: 0;
  }

  .modal-close-btn {
    background: var(--vt-c-gray-100);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .modal-close-btn:hover {
    background: var(--border-light);
    color: var(--vt-c-gray-900);
  }

  /* No cards options */
  .no-cards-options {
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .no-cards-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--border-light);
    border-radius: 10px;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .no-cards-option:hover {
    background: var(--surface-hover);
    border-color: var(--_accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--_accent) 8%, transparent);
  }

  .no-cards-option__icon {
    width: 38px;
    height: 38px;
    background: var(--_accent-bg);
    color: var(--_accent);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .no-cards-option__text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .no-cards-option__text strong {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--vt-c-gray-900);
  }

  .no-cards-option__text span {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .no-cards-option__arrow {
    font-size: 0.8125rem;
    color: var(--vt-c-gray-400);
  }

  .no-cards-divider {
    position: relative;
    text-align: center;
    margin: 0.75rem 0;
  }

  .no-cards-divider::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border-light);
  }

  .no-cards-divider span {
    position: relative;
    background: var(--surface-card);
    padding: 0 0.75rem;
    font-size: 0.8rem;
    color: var(--vt-c-gray-400);
    font-weight: 500;
  }

  .generating-text {
    font-size: 0.8rem;
    color: var(--_accent);
    font-weight: 500;
  }

  /* Payment Tabs */
  .payment-tabs {
    display: flex;
    border-bottom: 2px solid var(--border-light);
    margin: 0 1.5rem;
  }

  .payment-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.875rem 0.75rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .payment-tab--active {
    color: var(--_accent);
    border-bottom-color: var(--_accent);
  }

  .payment-tab:hover:not(.payment-tab--active) {
    color: var(--color-text-secondary);
  }

  /* Payment Form */
  .payment-form {
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-field__label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }

  .form-field__required {
    color: var(--color-danger);
    margin-left: 2px;
  }

  .card-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1.5px solid var(--border-light);
    border-radius: 10px;
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .card-option--selected {
    border-color: var(--_accent);
    background: var(--_accent-bg);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--_accent) 10%, transparent);
  }

  .card-option__icon {
    width: 32px;
    height: 32px;
    background: var(--vt-c-gray-100);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    color: var(--_accent);
    flex-shrink: 0;
  }

  .card-option--selected .card-option__icon {
    background: var(--_accent-bg-md);
  }

  .card-option__number {
    font-weight: 600;
    color: var(--vt-c-gray-900);
    flex: 1;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
  }

  .card-option__holder {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .card-option__check {
    width: 20px;
    height: 20px;
    background: var(--_accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-white);
    font-size: 0.65rem;
    flex-shrink: 0;
  }

  .form-field__input {
    width: 100%;
    padding: 0.6875rem 0.875rem;
    border: 1.5px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    color: var(--vt-c-gray-900);
    background: var(--surface-card);
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    box-sizing: border-box;
  }

  .form-field__input:focus {
    outline: none;
    border-color: var(--_accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--_accent) 12%, transparent);
  }

  .form-field__input:disabled {
    background: var(--surface-hover);
    color: var(--vt-c-gray-400);
    cursor: not-allowed;
  }

  .payment-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--color-danger) 6%, transparent);
    border: 1px solid var(--vt-c-danger-lighter);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    color: var(--color-danger-dark);
  }

  .payment-error i {
    flex-shrink: 0;
  }

  .payment-modal__actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .payment-modal__actions .btn {
    flex: 1;
  }

  /* Payment Link Section */
  .payment-link-section {
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .payment-link-info {
    text-align: center;
    padding: 1.25rem 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .payment-link-info__icon {
    width: 56px;
    height: 56px;
    background: var(--_accent-bg);
    color: var(--_accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }

  .payment-link-info__desc {
    font-size: 0.9375rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.55;
    max-width: 300px;
  }

  .payment-link-info__note {
    font-size: 0.8125rem;
    color: var(--vt-c-gray-400);
    margin: 0;
    line-height: 1.4;
  }

  /* =============================================
   RESPONSIVE
   ============================================= */
  @media (max-width: 640px) {
    .actions-section__buttons {
      flex-direction: column;
      align-items: stretch;
    }

    .actions-section__buttons .btn {
      width: 100%;
    }

    .alert {
      padding: 0.875rem 1rem;
    }

    .card__header {
      padding: 0.875rem 1rem;
    }

    .summary-rows {
      padding: 0.75rem 1rem 0.875rem;
    }

    .delivery-details {
      padding: 0.75rem 1rem 0.875rem;
    }

    .payment-modal {
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: 100%;
      max-height: 92vh;
    }

    .modal-overlay {
      align-items: flex-end;
      padding: 0;
    }

    .payment-tabs {
      margin: 0 1rem;
    }

    .payment-form {
      padding: 1rem;
    }

    .payment-link-section {
      padding: 1rem;
    }

    .no-cards-options {
      padding: 1rem;
    }

    .payment-modal__header {
      padding: 1rem 1rem 0.875rem;
    }
  }
</style>
