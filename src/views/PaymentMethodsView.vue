<template>
  <div class="payment-methods-view">
    <AppHeader
      title="Métodos de Pago"
      :user-name="currentUser?.first_name || 'Usuario'"
      :user-email="currentUser?.email"
      @logout="handleLogout"
    />

    <div class="container">
      <div class="page-header">
        <div class="page-header__icon">
          <i class="pi pi-credit-card"></i>
        </div>
        <div>
          <h1 class="page-header__title">Métodos de Pago</h1>
          <p class="page-header__subtitle">Gestiona tus tarjetas para pagos automáticos</p>
        </div>
      </div>

      <div v-if="loading" class="state-container">
        <i class="pi pi-spin pi-spinner state-container__spinner"></i>
        <p class="state-container__text">Cargando métodos de pago...</p>
      </div>

      <div v-else>
        <div class="payment-methods-list">
          <div v-if="paymentMethods.length === 0" class="empty-state card-modern">
            <div class="empty-state__icon">
              <i class="pi pi-credit-card"></i>
            </div>
            <h3 class="empty-state__title">No tienes métodos de pago configurados</h3>
            <p class="empty-state__text">Agrega una tarjeta para que los pagos se procesen automáticamente cuando entregues un pedido.</p>
          </div>

          <div
            v-for="method in paymentMethods"
            :key="method.id"
            class="payment-card card-modern hover-lift"
          >
            <div class="payment-card__body">
              <div class="payment-card__left">
                <div class="payment-card__icon">
                  <i class="pi pi-credit-card"></i>
                </div>
                <div class="payment-card__details">
                  <div class="payment-card__number">
                    <span class="payment-card__dots">•••• •••• ••••</span>
                    <span class="payment-card__last">{{ method.last_four_digits }}</span>
                  </div>
                  <div class="payment-card__meta">
                    <span class="payment-card__holder">{{ method.cardholder_name }}</span>
                    <span class="payment-card__expiry">{{ method.expiration_month }}/{{ method.expiration_year }}</span>
                  </div>
                </div>
              </div>
              <div class="payment-card__actions">
                <Badge v-if="method.is_default" value="Predeterminada" severity="success" />
                <Button
                  v-if="!method.is_default"
                  label="Predeterminar"
                  icon="pi pi-check"
                  size="small"
                  outlined
                  @click="setAsDefault(method.id)"
                  :loading="updating === method.id"
                />
                <Button
                  label="Eliminar"
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  outlined
                  @click="confirmDelete(method.id)"
                  :loading="deleting === method.id"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="add-section">
          <Button
            label="Agregar Tarjeta"
            icon="pi pi-plus"
            class="btn-primary"
            @click="showAddModal = true"
            :disabled="adding"
          />
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="showAddModal"
      modal
      header="Agregar Tarjeta"
      :style="{ width: '500px' }"
      :closable="true"
    >
      <form @submit.prevent="handleAddCard" class="card-form">
        <div class="form-field">
          <label class="form-field__label" for="cardholder">Nombre del titular *</label>
          <InputText
            id="cardholder"
            v-model="formData.cardholder_name"
            placeholder="Ej: JUAN PEREZ"
            required
            :disabled="adding"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label class="form-field__label" for="docNumber">DNI del titular *</label>
          <InputText
            id="docNumber"
            v-model="formData.doc_number"
            placeholder="12345678"
            required
            :disabled="adding"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label class="form-field__label" for="cardNumber">Número de tarjeta *</label>
          <InputText
            id="cardNumber"
            v-model="formData.card_number"
            placeholder="1234 5678 9012 3456"
            required
            :disabled="adding"
            @input="formatCardNumber"
            @paste="handleCardNumberPaste"
            class="w-full"
          />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-field__label" for="expiryMonth">Mes *</label>
            <InputText
              id="expiryMonth"
              v-model="formData.expiration_month"
              placeholder="MM"
              maxlength="2"
              required
              :disabled="adding"
              @input="formatMonth"
            />
          </div>
          <div class="form-field">
            <label class="form-field__label" for="expiryYear">Año *</label>
            <InputText
              id="expiryYear"
              v-model="formData.expiration_year"
              placeholder="AA"
              maxlength="2"
              required
              :disabled="adding"
              @input="formatYear"
            />
          </div>
          <div class="form-field">
            <label class="form-field__label" for="cvv">CVV *</label>
            <InputText
              id="cvv"
              v-model="formData.security_code"
              placeholder="123"
              maxlength="4"
              required
              :disabled="adding"
              type="password"
              @input="formatCVV"
            />
          </div>
        </div>

        <div class="form-check">
          <Checkbox
            v-model="formData.is_default"
            inputId="isDefault"
            :binary="true"
            :disabled="adding"
          />
          <label for="isDefault" class="form-check__label">Establecer como tarjeta predeterminada</label>
        </div>

        <div v-if="error" class="alert-error">
          <i class="pi pi-exclamation-triangle"></i>
          {{ error }}
        </div>

        <div class="form-actions">
          <Button
            label="Cancelar"
            severity="secondary"
            outlined
            @click="showAddModal = false"
            :disabled="adding"
          />
          <Button
            label="Agregar Tarjeta"
            type="submit"
            :loading="adding"
            :disabled="adding"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="showDeleteConfirm"
      modal
      header="Confirmar Eliminación"
      :style="{ width: '400px' }"
    >
      <p class="delete-confirm__text">¿Estás seguro de que deseas eliminar esta tarjeta?</p>
      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showDeleteConfirm = false" />
        <Button label="Eliminar" severity="danger" @click="handleDelete" :loading="deleting === deletingId" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { authService } from '../api/authService'
import { paymentMethodService } from '../api/paymentMethodService'
import { mercadopagoService } from '../api/mercadopagoService'
import type { PaymentMethod, PaymentMethodCreate } from '../types/payment'
import { AppHeader } from '@/components/ui'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Badge from 'primevue/badge'

const router = useRouter()
const route = useRoute()
const toast = useToast()

// Check if we came from claim page
const returnTo = route.query.returnTo as string
const claimToken = route.query.token as string

const currentUser = ref<{ id: string; first_name?: string; email?: string } | null>(null)
const paymentMethods = ref<PaymentMethod[]>([])
const loading = ref(true)
const adding = ref(false)
const updating = ref<number | null>(null)
const deleting = ref<number | null>(null)
const error = ref<string | null>(null)
const showAddModal = ref(false)
const showDeleteConfirm = ref(false)
const deletingId = ref<number | null>(null)

const formData = ref<{
  cardholder_name: string
  card_number: string
  expiration_month: string
  expiration_year: string
  security_code: string
  doc_number: string
  is_default: boolean
}>({
  cardholder_name: '',
  card_number: '',
  expiration_month: '',
  expiration_year: '',
  security_code: '',
  doc_number: '',
  is_default: false
})

const loadUser = async () => {
  try {
    const response = await authService.me()
    currentUser.value = response.data
  } catch (err) {
    console.error('Error loading user:', err)
    router.push('/login')
  }
}

const loadPaymentMethods = async () => {
  if (!currentUser.value?.id) return

  try {
    loading.value = true
    paymentMethods.value = await paymentMethodService.getPaymentMethods()
  } catch (err: any) {
    console.error('Error loading payment methods:', err)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'No se pudieron cargar los métodos de pago',
      life: 3000
    })
  } finally {
    loading.value = false
  }
}

const formatCardNumber = (event: Event) => {
  const input = event.target as HTMLInputElement
  let value = input.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 16)
  let formatted = ''
  for (let i = 0; i < value.length; i += 4) {
    formatted += value.slice(i, i + 4) + ' '
  }
  formData.value.card_number = formatted.trim()
}

const handleCardNumberPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pasted = event.clipboardData?.getData('text') || ''
  const digits = pasted.replace(/\D/g, '').slice(0, 16)
  let formatted = ''
  for (let i = 0; i < digits.length; i += 4) {
    formatted += digits.slice(i, i + 4) + ' '
  }
  formData.value.card_number = formatted.trim()
}

const formatMonth = (event: Event) => {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 2)
  formData.value.expiration_month = digits
  if (digits.length === 2) {
    document.getElementById('expiryYear')?.focus()
  }
}

const formatYear = (event: Event) => {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 2)
  formData.value.expiration_year = digits
  if (digits.length === 2) {
    document.getElementById('cvv')?.focus()
  }
}

const formatCVV = (event: Event) => {
  const input = event.target as HTMLInputElement
  formData.value.security_code = input.value.replace(/\D/g, '').slice(0, 4)
}

const handleAddCard = async () => {
  if (!currentUser.value?.id) return

  error.value = null
  adding.value = true

  try {
    const cardNumber = formData.value.card_number.replace(/\s/g, '')
    const lastFourDigits = cardNumber.slice(-4)
    const yearRaw = formData.value.expiration_year
    const fullYear = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw

    const tokenData = {
      card_expiration_month: formData.value.expiration_month.padStart(2, '0'),
      card_expiration_year: fullYear,
      card_number: cardNumber,
      cardholder_name: formData.value.cardholder_name.toUpperCase(),
      security_code: formData.value.security_code,
      doc_type: 'DNI',
      doc_number: formData.value.doc_number
    }

    const bin = cardNumber.slice(0, 6)
    const [tokenResponse, paymentMethodId] = await Promise.all([
      mercadopagoService.createToken(tokenData),
      mercadopagoService.getPaymentMethodByBin(bin)
    ])

    const paymentMethodData: PaymentMethodCreate = {
      card_token_id: tokenResponse.id,
      last_four_digits: lastFourDigits,
      payment_method_id: paymentMethodId,
      cardholder_name: formData.value.cardholder_name.toUpperCase(),
      expiration_month: formData.value.expiration_month.padStart(2, '0'),
      expiration_year: fullYear,
      is_default: formData.value.is_default || paymentMethods.value.length === 0,
      payer_email: currentUser.value.email,
      // Raw card fields so the backend can create a server-side token for customer card saving.
      card_number: formData.value.card_number.replace(/\s/g, ''),
      security_code: formData.value.security_code,
      doc_type: 'DNI',
      doc_number: formData.value.doc_number
    }

    await paymentMethodService.createPaymentMethod(paymentMethodData)

    toast.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Tarjeta agregada correctamente',
      life: 3000
    })

    showAddModal.value = false
    formData.value = {
      cardholder_name: '',
      card_number: '',
      expiration_month: '',
      expiration_year: '',
      security_code: '',
      doc_number: '',
      is_default: false
    }

    await loadPaymentMethods()

    // If we came from claim page, redirect back
    if (returnTo === 'claim' && claimToken) {
      setTimeout(() => {
        router.push(`/order/claim/${claimToken}`)
      }, 1500) // Wait 1.5s to show success message
    }
  } catch (err: any) {
    console.error('Error adding card:', err)
    error.value = err.response?.data?.message || err.message || 'Error al agregar la tarjeta'
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.value,
      life: 5000
    })
  } finally {
    adding.value = false
  }
}

const setAsDefault = async (id: number) => {
  if (!currentUser.value?.id) return

  updating.value = id
  try {
    await paymentMethodService.updatePaymentMethod(id, { is_default: true })
    toast.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Tarjeta establecida como predeterminada',
      life: 3000
    })
    await loadPaymentMethods()
  } catch (err: any) {
    console.error('Error setting default:', err)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'No se pudo establecer como predeterminada',
      life: 3000
    })
  } finally {
    updating.value = null
  }
}

const confirmDelete = (id: number) => {
  deletingId.value = id
  showDeleteConfirm.value = true
}

const handleDelete = async () => {
  if (!currentUser.value?.id || !deletingId.value) return

  deleting.value = deletingId.value
  try {
    await paymentMethodService.deletePaymentMethod(deletingId.value)
    toast.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Tarjeta eliminada correctamente',
      life: 3000
    })
    showDeleteConfirm.value = false
    deletingId.value = null
    await loadPaymentMethods()
  } catch (err: any) {
    console.error('Error deleting card:', err)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'No se pudo eliminar la tarjeta',
      life: 3000
    })
  } finally {
    deleting.value = null
  }
}

const handleLogout = () => {
  authService.logout()
  router.push('/login')
}

onMounted(async () => {
  await loadUser()
  await loadPaymentMethods()
})
</script>

<style scoped>
.payment-methods-view {
  min-height: 100vh;
  background: var(--surface-ground);
}

/* Page header */
.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.page-header__icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-white);
  font-size: 1.25rem;
  flex-shrink: 0;
}

.page-header__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
  line-height: 1.2;
}

.page-header__subtitle {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  margin: 0;
}

/* State container (loading) */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl) 0;
  gap: var(--spacing-sm);
}

.state-container__spinner {
  font-size: 2rem;
  color: var(--color-primary);
}

.state-container__text {
  color: var(--color-text-muted);
  margin: 0;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-xl);
}

.empty-state__icon {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-xl);
  background: var(--bg-light);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--spacing-md);
  font-size: 1.75rem;
  color: var(--color-text-muted);
}

.empty-state__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
}

.empty-state__text {
  color: var(--color-text-muted);
  max-width: 480px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Payment card list */
.payment-methods-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.payment-card {
  padding: var(--spacing-lg);
}

.payment-card__body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.payment-card__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  min-width: 0;
}

.payment-card__icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  background: var(--bg-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.payment-card__details {
  flex: 1;
  min-width: 0;
}

.payment-card__number {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.payment-card__dots {
  letter-spacing: 0.2rem;
  color: var(--color-text-secondary);
}

.payment-card__last {
  font-weight: 700;
  color: var(--color-text-primary);
}

.payment-card__meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.payment-card__actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  flex-wrap: wrap;
}

/* Add section */
.add-section {
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
}

/* Dialog form */
.card-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-top: var(--spacing-sm);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-field__label {
  font-weight: 500;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.form-check {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.form-check__label {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.alert-error {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger-dark);
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.delete-confirm__text {
  color: var(--color-text-secondary);
  margin: 0;
}

.w-full {
  width: 100%;
}

@media (max-width: 640px) {
  .payment-card__body {
    flex-direction: column;
    align-items: flex-start;
  }

  .payment-card__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .form-row {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
</style>
