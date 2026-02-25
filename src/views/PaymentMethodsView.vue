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
        <h1>Métodos de Pago</h1>
        <p class="subtitle">Gestiona tus tarjetas para pagos automáticos</p>
      </div>

      <div v-if="loading" class="loading-container">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
        <p>Cargando métodos de pago...</p>
      </div>

      <div v-else>
        <div class="payment-methods-list">
          <div v-if="paymentMethods.length === 0" class="empty-state">
            <i class="pi pi-credit-card" style="font-size: 3rem; color: #94a3b8"></i>
            <h3>No tienes métodos de pago configurados</h3>
            <p>Agrega una tarjeta para que los pagos se procesen automáticamente cuando entregues un pedido.</p>
          </div>

          <div v-for="method in paymentMethods" :key="method.id" class="payment-method-card">
            <div class="method-info">
              <div class="method-header">
                <div class="card-icon">
                  <i class="pi pi-credit-card"></i>
                </div>
                <div class="method-details">
                  <div class="card-number">
                    <span class="dots">•••• •••• ••••</span>
                    <span class="last-digits">{{ method.last_four_digits }}</span>
                  </div>
                  <div class="card-info">
                    <span class="cardholder">{{ method.cardholder_name }}</span>
                    <span class="expiry">{{ method.expiration_month }}/{{ method.expiration_year }}</span>
                  </div>
                </div>
              </div>
              <div class="method-actions">
                <Badge v-if="method.is_default" value="Predeterminada" severity="success" />
                <Button 
                  v-if="!method.is_default"
                  label="Establecer como predeterminada"
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

        <div class="add-method-section">
          <Button 
            label="Agregar Tarjeta"
            icon="pi pi-plus"
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
      <form @submit.prevent="handleAddCard" class="add-card-form">
        <div class="form-group">
          <label for="cardholder">Nombre del titular *</label>
          <InputText 
            id="cardholder"
            v-model="formData.cardholder_name"
            placeholder="Ej: JUAN PEREZ"
            required
            :disabled="adding"
          />
        </div>

        <div class="form-group">
          <label for="docNumber">DNI del titular *</label>
          <InputText
            id="docNumber"
            v-model="formData.doc_number"
            placeholder="12345678"
            required
            :disabled="adding"
          />
        </div>

        <div class="form-group">
          <label for="cardNumber">Número de tarjeta *</label>
          <InputText 
            id="cardNumber"
            v-model="formData.card_number"
            placeholder="1234 5678 9012 3456"
            required
            :disabled="adding"
            @input="formatCardNumber"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="expiryMonth">Mes *</label>
            <InputText 
              id="expiryMonth"
              v-model="formData.expiration_month"
              placeholder="MM"
              maxlength="2"
              required
              :disabled="adding"
            />
          </div>
          <div class="form-group">
            <label for="expiryYear">Año *</label>
            <InputText 
              id="expiryYear"
              v-model="formData.expiration_year"
              placeholder="YYYY"
              maxlength="4"
              required
              :disabled="adding"
            />
          </div>
          <div class="form-group">
            <label for="cvv">CVV *</label>
            <InputText 
              id="cvv"
              v-model="formData.security_code"
              placeholder="123"
              maxlength="4"
              required
              :disabled="adding"
              type="password"
            />
          </div>
        </div>

        <div class="form-group">
          <Checkbox 
            v-model="formData.is_default" 
            inputId="isDefault"
            :binary="true"
            :disabled="adding"
          />
          <label for="isDefault" class="checkbox-label">Establecer como tarjeta predeterminada</label>
        </div>

        <div v-if="error" class="error-message">
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
      <p>¿Estás seguro de que deseas eliminar esta tarjeta?</p>
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
  let value = input.value.replace(/\s/g, '')
  value = value.replace(/\D/g, '')
  
  let formatted = ''
  for (let i = 0; i < value.length; i += 4) {
    formatted += value.slice(i, i + 4) + ' '
  }
  formatted = formatted.trim()
  
  formData.value.card_number = formatted
}

const handleAddCard = async () => {
  if (!currentUser.value?.id) return

  error.value = null
  adding.value = true

  try {
    const cardNumber = formData.value.card_number.replace(/\s/g, '')
    const lastFourDigits = cardNumber.slice(-4)

    const tokenData = {
      card_expiration_month: formData.value.expiration_month.padStart(2, '0'),
      card_expiration_year: formData.value.expiration_year,
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
      expiration_year: formData.value.expiration_year,
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
  background: #f8fafc;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.25rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #64748b;
  font-size: 1rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
  color: #64748b;
}

.payment-methods-list {
  margin-bottom: 2rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-state h3 {
  margin: 1rem 0 0.5rem;
  color: #1e293b;
}

.empty-state p {
  color: #64748b;
  max-width: 500px;
  margin: 0 auto;
}

.payment-method-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.method-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.method-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.card-icon {
  font-size: 2rem;
  color: #3b82f6;
}

.method-details {
  flex: 1;
}

.card-number {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.dots {
  letter-spacing: 0.25rem;
  margin-right: 0.5rem;
}

.last-digits {
  color: #64748b;
}

.card-info {
  display: flex;
  gap: 1rem;
  color: #64748b;
  font-size: 0.875rem;
}

.method-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.add-method-section {
  text-align: center;
  padding: 2rem 0;
}

.add-card-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #1e293b;
  font-size: 0.875rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
}

.checkbox-label {
  margin-left: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}

.error-message {
  background: #fee2e2;
  color: #991b1b;
  padding: 0.75rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
</style>
