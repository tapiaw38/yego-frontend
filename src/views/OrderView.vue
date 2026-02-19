<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderService } from '../api/orderService'
import { profileService } from '../api/profileService'
import { authService } from '../api/authService'
import { settingsService } from '../api/settingsService'
import { paymentService } from '../api/paymentService'
import type { Order } from '../types/order'
import { calculateOrderTotal, formatPrice } from '../types/order'
import type { Profile } from '../types/profile'
import type { PaymentMethod } from '../types/payment'
import type { DeliveryFeeResult } from '../types/settings'
import { isAdmin } from '../types/auth'
import OrderHeader from '../components/OrderHeader.vue'
import OrderTimeline from '../components/OrderTimeline.vue'
import OrderItemsModal from '../components/OrderItemsModal.vue'
import wappiLogo from '../assets/img/wappi-logo.png'
import { AppHeader } from '@/components/ui'

const route = useRoute()
const router = useRouter()
const order = ref<Order | null>(null)
const profile = ref<Profile | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const lastUpdated = ref<Date | null>(null)
const showItemsModal = ref(false)
const currentUserId = ref<string | null>(null)
const isUserAdmin = ref(false)
const markingDelivered = ref(false)
const deliveryFee = ref<DeliveryFeeResult | null>(null)
const calculatingDelivery = ref(false)
const hasPaymentMethod = ref<boolean | null>(null)

// Location reminder banner (per-order dismissal)
const showLocationReminder = ref(false)

const locationReminderKey = computed(() => `wappi_location_reminder_${order.value?.id}`)

watch(() => order.value?.id, (orderId) => {
  if (orderId) {
    showLocationReminder.value = localStorage.getItem(`wappi_location_reminder_${orderId}`) !== 'dismissed'
  }
}, { immediate: true })

const dismissLocationReminder = () => {
  showLocationReminder.value = false
  localStorage.setItem(locationReminderKey.value, 'dismissed')
}

// Payment form state
const showPaymentModal = ref(false)
const paymentMethods = ref<PaymentMethod[]>([])
const selectedPaymentMethod = ref<PaymentMethod | null>(null)
const cvv = ref('')
const processingPayment = ref(false)
const paymentError = ref<string | null>(null)
const locationError = ref<string | null>(null)

let refreshInterval: ReturnType<typeof setInterval> | null = null

// Check if the current user is the owner of the profile
const isProfileOwner = computed(() => {
  if (!currentUserId.value || !profile.value) return false
  return profile.value.user_id === currentUserId.value
})

// Check if profile can be edited: only before payment (CREATED status)
const canEditProfile = computed(() => {
  if (!order.value) return false
  if (!isProfileOwner.value) return false
  return order.value.status === 'CREATED'
})

// Check if order has items data
const hasOrderItems = computed(() => {
  return order.value?.data?.items && order.value.data.items.length > 0
})

// Check if user can edit order items (only admin)
const canEditItems = computed(() => {
  return isUserAdmin.value
})

// Check if user can request modification (profile owner AND status before ON_THE_WAY)
const canRequestModification = computed(() => {
  if (!isProfileOwner.value || !order.value) return false
  if (isUserAdmin.value) return false // Admin edits directly
  return ['CREATED', 'CONFIRMED', 'PREPARING'].includes(order.value.status)
})

// Calculate order total
const orderTotal = computed(() => {
  return calculateOrderTotal(order.value?.data)
})

// Check if there are items with pending price
const hasPendingPrices = computed(() => {
  return order.value?.data?.items?.some(item => item.price === 0) ?? false
})

// Calculate grand total (products + delivery)
const grandTotal = computed(() => {
  const productsTotal = orderTotal.value
  const deliveryTotal = deliveryFee.value?.total_price || 0
  return productsTotal + deliveryTotal
})

// Calculate delivery fee
const calculateDeliveryFee = async () => {
  if (!profile.value?.location || !order.value?.data?.items) {
    deliveryFee.value = null
    return
  }

  calculatingDelivery.value = true
  try {
    const items = order.value.data.items.map(item => ({
      quantity: item.quantity,
      weight: item.weight
    }))

    deliveryFee.value = await settingsService.calculateDeliveryFee({
      user_latitude: profile.value.location.latitude,
      user_longitude: profile.value.location.longitude,
      items
    })
  } catch (err) {
    console.error('Error calculating delivery fee:', err)
    deliveryFee.value = null
  } finally {
    calculatingDelivery.value = false
  }
}

const fetchOrder = async () => {
  try {
    const id = route.params.id as string
    order.value = await orderService.getOrder(id)
    lastUpdated.value = new Date()
    error.value = null
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { message?: string } } }
    error.value = axiosError.response?.data?.message || 'No se pudo cargar el pedido'
    order.value = null
  } finally {
    loading.value = false
  }
}

const fetchProfile = async (profileId: string) => {
  try {
    profile.value = await profileService.getProfile(profileId)
  } catch (err: unknown) {
    console.error('Error fetching profile:', err)
    profile.value = null
  }
}

// Fetch profile when order is loaded
watch(() => order.value?.profile_id, (profileId) => {
  if (profileId) {
    fetchProfile(profileId)
  }
}, { immediate: true })

// Check payment method when profile is loaded
watch(() => profile.value?.user_id, async (userId) => {
  if (userId && isProfileOwner.value) {
    try {
      const result = await paymentService.checkPaymentMethod(userId)
      hasPaymentMethod.value = result.has_payment_method
    } catch (err) {
      console.error('Error checking payment method:', err)
      hasPaymentMethod.value = null
    }
  }
}, { immediate: true })

// Calculate delivery fee when profile and order data are available
watch([() => profile.value?.location, () => order.value?.data?.items], () => {
  calculateDeliveryFee()
}, { immediate: true })

const refresh = async () => {
  await fetchOrder()
}

const editProfile = () => {
  if (order.value) {
    router.push(`/edit-profile/${order.value.profile_id}`)
  }
}

// Get current user ID from JWT token
const getCurrentUserId = (): string | null => {
  const token = localStorage.getItem('token')
  if (!token) return null

  try {
    // Decode JWT payload (base64)
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = parts[1] as string
    const decoded = JSON.parse(atob(payload))
    return decoded.user_id || null
  } catch {
    return null
  }
}

// Check if admin can mark order as delivered
const canMarkDelivered = computed(() => {
  if (!isUserAdmin.value || !order.value) return false
  return order.value.status !== 'DELIVERED' && order.value.status !== 'CANCELLED'
})

// Check if current user can pay (profile owner + status CREATED)
const canPay = computed(() => {
  if (!isProfileOwner.value || !order.value) return false
  if (isUserAdmin.value) return false
  return order.value.status === 'CREATED'
})

const openPaymentModal = async () => {
  if (!profile.value?.location) {
    locationError.value = 'Debés agregar una dirección de entrega antes de pagar.'
    return
  }
  locationError.value = null

  paymentError.value = null
  cvv.value = ''
  selectedPaymentMethod.value = null
  try {
    const methods = await paymentService.getPaymentMethods()
    paymentMethods.value = methods
    const defaultMethod = methods.find(m => m.is_default)
    selectedPaymentMethod.value = defaultMethod || methods[0] || null
  } catch (err) {
    console.error('Error fetching payment methods:', err)
    paymentMethods.value = []
  }
  showPaymentModal.value = true
}

const processPayment = async () => {
  if (!order.value || !cvv.value || !selectedPaymentMethod.value) return

  if (cvv.value.length < 3 || cvv.value.length > 4) {
    paymentError.value = 'El CVV debe tener 3 o 4 dígitos'
    return
  }

  processingPayment.value = true
  paymentError.value = null

  try {
    await orderService.payForOrder(order.value.id, cvv.value)
    showPaymentModal.value = false
    await fetchOrder()
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { code?: string; message?: string } } }
    const errorCode = axiosError.response?.data?.code
    if (errorCode === 'order:payment-failed') {
      paymentError.value = 'El pago falló. Verificá tu CVV e intentá nuevamente.'
    } else {
      paymentError.value = axiosError.response?.data?.message || 'Error al procesar el pago.'
    }
  } finally {
    processingPayment.value = false
  }
}

// Check if order is delivered (all dots should be green)
const isDelivered = computed(() => {
  return order.value?.status === 'DELIVERED'
})

// Check admin status - only if authenticated
const checkAdminStatus = async () => {
  if (!authService.isAuthenticated()) {
    isUserAdmin.value = false
    return
  }
  try {
    const response = await authService.me()
    isUserAdmin.value = isAdmin(response.data)
  } catch {
    isUserAdmin.value = false
  }
}



// Mark order as delivered
const markAsDelivered = async () => {
  if (!order.value || markingDelivered.value) return

  markingDelivered.value = true
  try {
    await orderService.updateStatus(order.value.id, { status: 'DELIVERED' })
    await fetchOrder()
  } catch (err) {
    console.error('Error marking order as delivered:', err)
  } finally {
    markingDelivered.value = false
  }
}

// Handle order data update from modal
const handleOrderDataUpdated = async () => {
  await fetchOrder()
  showItemsModal.value = false
}

// Handle modification request from modal
const handleModificationRequested = async () => {
  await fetchOrder()
  showItemsModal.value = false
}

onMounted(() => {
  currentUserId.value = getCurrentUserId()
  checkAdminStatus()
  fetchOrder()
  // Auto-refresh every 30 seconds
  refreshInterval = setInterval(fetchOrder, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="order-view">
    <AppHeader 
      title="Seguimiento de Pedido"
      :show-logo="true"
    />

    <main class="main-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando pedido...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon"><i class="pi pi-exclamation-triangle"></i></div>
        <h2>Pedido no encontrado</h2>
        <p>{{ error }}</p>
        <button @click="refresh" class="retry-button">
          Intentar de nuevo
        </button>
      </div>

      <!-- Order Content -->
      <div v-else-if="order" class="order-content">
        <OrderHeader :order="order" />

        <!-- Pay Now Banner (CREATED status) -->
        <div v-if="canPay" class="status-alert alert-pay-now">
          <div class="alert-content">
            <span class="alert-icon">
              <i class="pi pi-credit-card"></i>
            </span>
            <div class="alert-text">
              <strong>Completá el pago</strong>
              <p>Tu pedido está listo para ser pagado. Una vez pagado pasará al estado "Confirmado".</p>
              <p v-if="locationError" class="location-error">
                <i class="pi pi-exclamation-triangle"></i> {{ locationError }}
              </p>
            </div>
          </div>
          <button @click="openPaymentModal" class="alert-button pay-button">
            Pagar ahora
          </button>
        </div>

        <!-- No Payment Method Alert -->
        <div v-else-if="isProfileOwner && hasPaymentMethod === false && order.status === 'CREATED'"
             class="status-alert alert-payment">
          <div class="alert-content">
            <span class="alert-icon">
              <i class="pi pi-credit-card"></i>
            </span>
            <div class="alert-text">
              <strong>Configurá un método de pago</strong>
              <p>Necesitás agregar una tarjeta para poder pagar el pedido.</p>
            </div>
          </div>
          <button
            @click="router.push('/payment-methods')"
            class="alert-button"
          >
            Agregar tarjeta
          </button>
        </div>

        <!-- Status Message Alert -->
        <div v-if="order.status_message && (order.status === 'PAUSED' || order.status === 'CANCELLED' || order.status === 'MODIFICATION_REQUESTED')"
             :class="['status-alert', order.status === 'PAUSED' ? 'alert-paused' : order.status === 'MODIFICATION_REQUESTED' ? 'alert-modification' : 'alert-cancelled']">
          <div class="alert-content">
            <span class="alert-icon">
              <i v-if="order.status === 'PAUSED'" class="pi pi-pause"></i>
              <i v-else-if="order.status === 'MODIFICATION_REQUESTED'" class="pi pi-pencil"></i>
              <i v-else class="pi pi-times-circle"></i>
            </span>
            <div class="alert-text">
              <strong>{{ order.status === 'PAUSED' ? 'Tu pedido está pausado' : order.status === 'MODIFICATION_REQUESTED' ? 'Modificación solicitada' : 'Tu pedido ha sido cancelado' }}</strong>
              <p>{{ order.status_message }}</p>
            </div>
          </div>
          <button
            v-if="order.status === 'PAUSED' && canEditProfile"
            @click="editProfile"
            class="alert-button"
          >
            Editar perfil
          </button>
        </div>

        <OrderTimeline :order="order" :all-completed="isDelivered" />

        <!-- Order Summary Card -->
        <div v-if="hasOrderItems" class="order-summary-card">
          <div class="summary-header">
            <h3>Resumen del pedido</h3>
            <button class="view-details-button" @click="showItemsModal = true">
              Ver detalle
            </button>
          </div>
          <div class="summary-content">
            <div class="summary-row">
              <span class="summary-label">Productos ({{ order.data!.items.length }})</span>
              <span class="summary-value">{{ formatPrice(orderTotal) }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Envío</span>
              <span class="summary-value" v-if="calculatingDelivery">Calculando...</span>
              <span class="summary-value" v-else-if="!profile?.location">Pendiente ubicación</span>
              <span class="summary-value" v-else-if="deliveryFee">{{ formatPrice(deliveryFee.total_price) }}</span>
              <span class="summary-value" v-else>--</span>
            </div>
            <div class="summary-row summary-total">
              <span class="summary-label">Total</span>
              <span class="summary-value total-amount">{{ formatPrice(grandTotal) }}</span>
            </div>
            <p v-if="hasPendingPrices" class="pending-price-notice">
              Estamos buscando el mejor precio para algunos productos...
            </p>
          </div>
        </div>

        <!-- Location Reminder Banner -->
        <div v-if="canPay && showLocationReminder" class="location-reminder-banner">
          <div class="reminder-content">
            <i class="pi pi-map-marker"></i>
            <span>Recordá verificar tu dirección de entrega antes de realizar el pago.</span>
          </div>
          <button class="reminder-close" @click="dismissLocationReminder" title="Cerrar">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Delivery Info Card -->
        <div v-if="profile" class="delivery-card">
          <div class="delivery-header">
            <h3>El pedido se entregará en:</h3>
            <div
              v-if="isProfileOwner"
              class="edit-button-wrapper"
              :title="!canEditProfile ? 'Los datos de entrega solo se pueden modificar antes de realizar el pago' : ''"
            >
              <button
                @click="canEditProfile && editProfile()"
                class="edit-button"
                :class="{ 'edit-button-disabled': !canEditProfile }"
                :disabled="!canEditProfile"
              >
                Cambiar datos
              </button>
            </div>
          </div>
          <div class="delivery-info">
            <div class="info-row">
              <span class="info-icon"><i class="pi pi-map-marker"></i></span>
              <span class="info-text">{{ profile.location?.address || 'Sin dirección' }}</span>
            </div>
            <div class="info-row">
              <span class="info-icon"><i class="pi pi-phone"></i></span>
              <span class="info-text">{{ profile.phone_number }}</span>
            </div>
          </div>
        </div>

        <div class="refresh-section">
          <div class="action-buttons">
            <button @click="refresh" class="refresh-button">
              🔄 Actualizar estado
            </button>
            <button
              v-if="canMarkDelivered"
              @click="markAsDelivered"
              :disabled="markingDelivered"
              class="delivered-button"
            >
              <i v-if="!markingDelivered" class="pi pi-check-circle"></i>
              {{ markingDelivered ? 'Marcando...' : 'Marcar entregado' }}
            </button>
          </div>
          <p v-if="lastUpdated" class="last-updated">
            Última actualización: {{ lastUpdated.toLocaleTimeString('es-ES') }}
          </p>
        </div>
      </div>
    </main>

    <footer class="app-footer">
      <img :src="wappiLogo" alt="Wappi" class="footer-logo" />
      <p>Powered by Nymia Assistant</p>
    </footer>

    <!-- Order Items Modal -->
    <OrderItemsModal
      v-if="order?.data"
      :data="order.data"
      :show="showItemsModal"
      :is-admin="canEditItems"
      :can-request-modification="canRequestModification"
      :order-id="order.id"
      @close="showItemsModal = false"
      @updated="handleOrderDataUpdated"
      @modification-requested="handleModificationRequested"
    />

    <!-- Payment Modal -->
    <div v-if="showPaymentModal" class="modal-overlay" @click.self="showPaymentModal = false">
      <div class="payment-modal">
        <div class="payment-modal-header">
          <h2>Pagar Pedido</h2>
          <button class="close-btn" @click="showPaymentModal = false">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div v-if="paymentMethods.length === 0" class="no-payment-methods">
          <i class="pi pi-credit-card"></i>
          <p>No tenés métodos de pago registrados.</p>
          <button class="add-card-btn" @click="router.push('/payment-methods'); showPaymentModal = false">
            Agregar tarjeta
          </button>
        </div>

        <div v-else class="payment-form">
          <div class="form-group">
            <label>Tarjeta</label>
            <div class="card-options">
              <label
                v-for="method in paymentMethods"
                :key="method.id"
                class="card-option"
                :class="{ selected: selectedPaymentMethod?.id === method.id }"
              >
                <input
                  type="radio"
                  :value="method"
                  v-model="selectedPaymentMethod"
                  style="display: none"
                />
                <i class="pi pi-credit-card"></i>
                <span>•••• {{ method.last_four_digits }}</span>
                <small>{{ method.cardholder_name }}</small>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="order-cvv">CVV *</label>
            <input
              id="order-cvv"
              v-model="cvv"
              type="password"
              placeholder="123"
              maxlength="4"
              class="cvv-input"
              :disabled="processingPayment"
            />
          </div>

          <div v-if="paymentError" class="payment-error">
            <i class="pi pi-exclamation-triangle"></i>
            {{ paymentError }}
          </div>

          <div class="payment-modal-actions">
            <button class="btn-cancel" @click="showPaymentModal = false" :disabled="processingPayment">
              Cancelar
            </button>
            <button
              class="btn-pay"
              @click="processPayment"
              :disabled="!cvv || !selectedPaymentMethod || processingPayment"
            >
              <i v-if="!processingPayment" class="pi pi-lock"></i>
              {{ processingPayment ? 'Procesando...' : 'Confirmar Pago' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-view {
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

@media (max-width: 480px) {
  .main-content {
    padding: 0.75rem;
  }
}

.loading-state,
.error-state {
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
  border: 4px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-state h2 {
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.error-state p {
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.retry-button,
.refresh-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.retry-button:hover,
.refresh-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.retry-button:active,
.refresh-button:active {
  transform: translateY(0);
}

.order-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.refresh-section {
  margin-top: 1.5rem;
  text-align: center;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.orders-list-button {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.orders-list-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.orders-list-button:active {
  transform: translateY(0);
}

.delivered-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.delivered-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.delivered-button:active:not(:disabled) {
  transform: translateY(0);
}

.delivered-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.last-updated {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin-top: 0.75rem;
}

.delivery-card {
  background: var(--bg-white);
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
  box-shadow: 0 1px 3px var(--shadow-light);
  border: 1px solid var(--border-light);
}

.delivery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.delivery-header h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

.edit-button-wrapper {
  position: relative;
}

.edit-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.edit-button:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-1px);
}

.edit-button:active:not(:disabled) {
  transform: translateY(0);
}

.edit-button-disabled {
  background: #d1d5db;
  color: #9ca3af;
  cursor: not-allowed;
}

.delivery-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.info-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.info-text {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  line-height: 1.4;
}

.edit-notice {
  font-size: 0.75rem;
  color: var(--color-text-placeholder);
  margin: 0.75rem 0 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
  text-align: center;
}

.order-summary-card {
  background: var(--bg-white);
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
  box-shadow: 0 1px 3px var(--shadow-light);
  border: 1px solid var(--border-light);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.summary-header h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.summary-value {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.summary-total {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-light);
  margin-top: 0.25rem;
}

.summary-total .summary-label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.total-amount {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-primary);
}

.pending-price-notice {
  font-size: 0.75rem;
  color: #f59e0b;
  margin: 0.5rem 0 0 0;
  padding: 0.5rem;
  background: #fffbeb;
  border-radius: 6px;
  text-align: center;
}

.view-details-button {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #e5e7eb;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.view-details-button:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.view-details-button:active {
  transform: translateY(0);
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

.status-alert {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid;
}

.alert-paused {
  border-left-color: #f59e0b;
  background: #fffbeb;
}

.alert-cancelled {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.alert-modification {
  border-left-color: #f97316;
  background: #fff7ed;
}

.alert-payment {
  border-left-color: #3b82f6;
  background: #eff6ff;
}

.alert-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.alert-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.alert-text {
  flex: 1;
}

.alert-text strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.alert-text p {
  font-size: 0.875rem;
  color: #4b5563;
  margin: 0;
  line-height: 1.5;
}

.alert-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
}

.alert-button:hover {
  background: #5a67d8;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .action-buttons {
    flex-direction: column;
  }

  .refresh-button,
  .delivered-button {
    width: 100%;
  }

  .delivery-card,
  .order-summary-card {
    padding: 0.875rem;
  }

  .status-alert {
    padding: 0.875rem;
  }

  .alert-content {
    flex-direction: column;
    gap: 0.5rem;
  }
}

/* Pay Now Alert */
.alert-pay-now {
  border-left-color: #10b981;
  background: #ecfdf5;
}

.location-error {
  margin: 0.375rem 0 0 0;
  font-size: 0.8rem;
  color: #b45309;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Location Reminder Banner */
.location-reminder-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #fefce8;
  border: 1px solid #fde68a;
  border-left: 4px solid #f59e0b;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}

.reminder-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #92400e;
  flex: 1;
}

.reminder-content i {
  color: #f59e0b;
  flex-shrink: 0;
}

.reminder-close {
  background: none;
  border: none;
  color: #b45309;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 0.875rem;
  flex-shrink: 0;
  transition: background 0.2s;
}

.reminder-close:hover {
  background: #fde68a;
}

.pay-button {
  background: #10b981 !important;
}

.pay-button:hover {
  background: #059669 !important;
}

/* Payment Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.payment-modal {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
}

.payment-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.payment-modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #374151;
}

.payment-form .form-group {
  margin-bottom: 1.25rem;
}

.payment-form label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
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
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.card-option.selected {
  border-color: #667eea;
  background: #f5f3ff;
}

.card-option i {
  color: #667eea;
  font-size: 1.25rem;
}

.card-option span {
  font-weight: 500;
  color: #1f2937;
  flex: 1;
}

.card-option small {
  font-size: 0.75rem;
  color: #6b7280;
}

.cvv-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.cvv-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.payment-error {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #991b1b;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.payment-modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-cancel {
  flex: 1;
  padding: 0.75rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-cancel:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-pay {
  flex: 2;
  padding: 0.75rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: opacity 0.2s;
}

.btn-pay:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-pay:disabled,
.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.no-payment-methods {
  text-align: center;
  padding: 1.5rem 0;
  color: #6b7280;
}

.no-payment-methods i {
  font-size: 2.5rem;
  color: #d1d5db;
  margin-bottom: 0.75rem;
  display: block;
}

.add-card-btn {
  margin-top: 1rem;
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.add-card-btn:hover {
  background: #5a67d8;
}
</style>
