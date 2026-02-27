<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { OrderData, OrderItem } from '../types/order'
import { calculateOrderTotal, formatPrice } from '../types/order'
import { orderService } from '../api/orderService'

const props = defineProps<{
  data: OrderData
  show: boolean
  isAdmin?: boolean
  canRequestModification?: boolean
  orderId?: string
}>()

const emit = defineEmits<{
  close: []
  updated: [data: OrderData]
  modificationRequested: []
}>()

const isEditing = ref(false)
const isRequestingModification = ref(false)
const saving = ref(false)
const submittingRequest = ref(false)
const editableItems = ref<OrderItem[]>([])
const modificationMessage = ref('')

// Initialize editable items when modal opens
watch(() => props.show, (newShow) => {
  if (newShow) {
    editableItems.value = props.data.items.map(item => ({ ...item }))
    isEditing.value = false
    isRequestingModification.value = false
    modificationMessage.value = ''
  }
})

const total = computed(() => {
  if (isEditing.value) {
    return editableItems.value.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }
  return calculateOrderTotal(props.data)
})

const startEditing = () => {
  editableItems.value = props.data.items.map(item => ({ ...item }))
  isEditing.value = true
}

const cancelEditing = () => {
  editableItems.value = props.data.items.map(item => ({ ...item }))
  isEditing.value = false
}

const addItem = () => {
  editableItems.value.push({
    name: '',
    price: 0,
    quantity: 1,
    weight: undefined
  })
}

const removeItem = (index: number) => {
  editableItems.value.splice(index, 1)
}

const saveChanges = async () => {
  if (!props.orderId || saving.value) return

  // Validate items
  const validItems = editableItems.value.filter(item =>
    item.name.trim() !== '' && item.price >= 0 && item.quantity > 0
  )

  if (validItems.length === 0) {
    alert('Debe haber al menos un producto valido')
    return
  }

  saving.value = true
  try {
    const newData: OrderData = { items: validItems }
    await orderService.updateOrder(props.orderId, { data: newData })
    emit('updated', newData)
    isEditing.value = false
  } catch (err) {
    console.error('Error updating order items:', err)
    alert('Error al guardar los cambios')
  } finally {
    saving.value = false
  }
}

const startRequestingModification = () => {
  modificationMessage.value = ''
  isRequestingModification.value = true
}

const cancelRequestingModification = () => {
  isRequestingModification.value = false
  modificationMessage.value = ''
}

const submitModificationRequest = async () => {
  if (!props.orderId || submittingRequest.value) return

  if (!modificationMessage.value.trim()) {
    alert('Por favor describe los cambios que necesitas')
    return
  }

  submittingRequest.value = true
  try {
    await orderService.updateOrder(props.orderId, {
      status: 'MODIFICATION_REQUESTED',
      status_message: modificationMessage.value.trim()
    })
    emit('modificationRequested')
    isRequestingModification.value = false
    handleClose()
  } catch (err) {
    console.error('Error submitting modification request:', err)
    alert('Error al enviar la solicitud')
  } finally {
    submittingRequest.value = false
  }
}

const handleClose = () => {
  isEditing.value = false
  isRequestingModification.value = false
  modificationMessage.value = ''
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="handleClose" role="dialog" aria-modal="true">
      <div class="modal-content card-modern">

        <!-- Header -->
        <div class="modal-header">
          <div class="modal-header__title-group">
            <i
              class="modal-header__icon pi"
              :class="isEditing ? 'pi-pencil text-success' : isRequestingModification ? 'pi-comment text-warning' : 'pi-list text-primary'"
            ></i>
            <h2 class="modal-header__title">
              {{ isEditing ? 'Editar pedido' : isRequestingModification ? 'Solicitar modificación' : 'Detalle del pedido' }}
            </h2>
          </div>
          <button class="modal-header__close" @click="handleClose" aria-label="Cerrar">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">

          <!-- Request Modification Form -->
          <div v-if="isRequestingModification" class="modification-form">
            <div class="current-items-summary">
              <p class="current-items-summary__heading text-gray-700">
                <i class="pi pi-shopping-cart"></i> Items actuales
              </p>
              <div class="current-items-summary__list">
                <div v-for="(item, index) in data.items" :key="index" class="summary-row">
                  <span class="text-gray-600">{{ item.name }} <span class="text-gray-400">x{{ item.quantity }}</span></span>
                  <span class="text-gray-700">{{ formatPrice(item.price * item.quantity) }}</span>
                </div>
              </div>
              <div class="summary-row summary-row--total">
                <span class="text-gray-700">Total</span>
                <span class="text-primary">{{ formatPrice(calculateOrderTotal(data)) }}</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="modificationMessage">Describe los cambios que necesitas</label>
              <textarea
                id="modificationMessage"
                v-model="modificationMessage"
                placeholder="Ej: Quisiera cambiar la pizza grande por una mediana, agregar una bebida..."
                rows="4"
                class="form-textarea"
              ></textarea>
            </div>

            <div class="info-banner info-banner--info">
              <i class="pi pi-info-circle info-banner__icon text-info"></i>
              <p class="info-banner__text">Tu pedido quedará en estado "Modificación Solicitada" hasta que el administrador procese tu solicitud.</p>
            </div>
          </div>

          <!-- View Mode -->
          <div v-else-if="!isEditing" class="items-list">
            <div
              v-for="(item, index) in data.items"
              :key="index"
              class="item-row"
              :class="{ 'item-row--pending': item.price === 0 }"
            >
              <div class="item-row__info">
                <span class="item-row__name text-gray-800">{{ item.name }}</span>
                <span class="item-row__qty text-gray-400">x{{ item.quantity }}</span>
              </div>
              <div v-if="item.price > 0" class="item-row__pricing">
                <span class="item-row__unit-price text-gray-400">{{ formatPrice(item.price) }} c/u</span>
                <span class="item-row__subtotal text-gray-800">{{ formatPrice(item.price * item.quantity) }}</span>
              </div>
              <div v-else class="item-row__pricing">
                <span class="pending-chip">
                  <i class="pi pi-clock"></i> Precio pendiente
                </span>
              </div>
            </div>

            <div class="total-row">
              <span class="total-row__label text-gray-700">Total del pedido</span>
              <span class="total-row__value text-primary">{{ formatPrice(total) }}</span>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="items-list">
            <div v-for="(item, index) in editableItems" :key="index" class="item-edit-card">
              <div class="item-edit-card__fields">
                <input
                  v-model="item.name"
                  type="text"
                  placeholder="Nombre del producto"
                  class="form-input"
                />
                <div class="item-edit-card__numbers">
                  <div class="field-group">
                    <label class="field-label">Precio</label>
                    <input v-model.number="item.price" type="number" min="0" step="0.01" class="form-input" />
                  </div>
                  <div class="field-group">
                    <label class="field-label">Cant.</label>
                    <input v-model.number="item.quantity" type="number" min="1" class="form-input" />
                  </div>
                  <div class="field-group">
                    <label class="field-label">Peso (g)</label>
                    <input v-model.number="item.weight" type="number" min="0" placeholder="Opc." class="form-input" />
                  </div>
                </div>
              </div>
              <button class="remove-btn" @click="removeItem(index)" title="Eliminar producto" aria-label="Eliminar producto">
                <i class="pi pi-trash"></i>
              </button>
            </div>

            <button class="add-item-btn" @click="addItem">
              <i class="pi pi-plus"></i> Agregar producto
            </button>

            <div class="total-row">
              <span class="total-row__label text-gray-700">Total del pedido</span>
              <span class="total-row__value text-primary">{{ formatPrice(total) }}</span>
            </div>

            <div v-if="canRequestModification" class="info-banner info-banner--info">
              <i class="pi pi-info-circle info-banner__icon text-info"></i>
              <p class="info-banner__text">Puedes solicitar modificaciones a tu pedido mientras no haya sido enviado. Una vez "En camino" no será posible realizar cambios.</p>
            </div>

            <div v-if="!isAdmin && !canRequestModification" class="info-banner info-banner--warning">
              <i class="pi pi-exclamation-triangle info-banner__icon text-warning"></i>
              <p class="info-banner__text">El pedido ya está en camino o ha sido entregado. No es posible solicitar modificaciones en este momento.</p>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <!-- Modification Request Mode -->
          <template v-if="isRequestingModification">
            <button class="modal-btn modal-btn--ghost" @click="cancelRequestingModification" :disabled="submittingRequest">
              Cancelar
            </button>
            <button class="modal-btn modal-btn--warning" @click="submitModificationRequest" :disabled="submittingRequest">
              <i class="pi pi-send"></i>
              {{ submittingRequest ? 'Enviando...' : 'Enviar solicitud' }}
            </button>
          </template>

          <!-- Edit Mode -->
          <template v-else-if="isEditing">
            <button class="modal-btn modal-btn--ghost" @click="cancelEditing" :disabled="saving">
              Cancelar
            </button>
            <button class="modal-btn modal-btn--success" @click="saveChanges" :disabled="saving">
              <i class="pi pi-check"></i>
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </template>

          <!-- View Mode -->
          <template v-else>
            <button v-if="isAdmin && orderId" class="modal-btn modal-btn--success" @click="startEditing">
              <i class="pi pi-pencil"></i> Editar
            </button>
            <button v-if="canRequestModification" class="modal-btn modal-btn--warning" @click="startRequestingModification">
              <i class="pi pi-comment"></i> Solicitar modificación
            </button>
            <button class="modal-btn modal-btn--primary" @click="handleClose">
              Cerrar
            </button>
          </template>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
}

/* Modal shell */
.modal-content {
  max-width: 460px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slide-up var(--transition-normal);
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.modal-header__title-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.modal-header__icon {
  font-size: 1.125rem;
}

.modal-header__title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.modal-header__close {
  background: var(--surface-hover);
  border: 1px solid var(--border-light);
  color: var(--color-text-muted);
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.modal-header__close:hover {
  background: var(--vt-c-gray-200);
  color: var(--color-text-primary);
}

/* Body */
.modal-body {
  padding: var(--spacing-md) var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Items list (view + edit) */
.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

/* View mode item row */
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--surface-hover);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  transition: border-color var(--transition-fast);
}

.item-row--pending {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}

.item-row__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.item-row__name {
  font-weight: 600;
  font-size: 0.9375rem;
}

.item-row__qty {
  font-size: 0.8125rem;
}

.item-row__pricing {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
}

.item-row__unit-price {
  font-size: 0.75rem;
}

.item-row__subtotal {
  font-weight: 700;
  font-size: 0.9375rem;
}

.pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--gradient-warning);
  color: var(--color-text-white);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}

/* Total row */
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-xs);
  border-top: 2px solid var(--border-light);
}

.total-row__label {
  font-size: 0.9375rem;
  font-weight: 600;
}

.total-row__value {
  font-size: 1.25rem;
  font-weight: 800;
}

/* Modification form */
.modification-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.current-items-summary {
  background: var(--surface-hover);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

.current-items-summary__heading {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: var(--spacing-xs);
}

.current-items-summary__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: var(--spacing-xs);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  padding: 0.2rem 0;
}

.summary-row--total {
  border-top: 1px solid var(--border-light);
  padding-top: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  font-weight: 700;
  font-size: 0.875rem;
}

/* Forms */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.form-textarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  color: var(--color-text-primary);
  background: var(--bg-white);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  line-height: 1.5;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

/* Info banners */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid;
}

.info-banner--info {
  background: color-mix(in srgb, var(--color-info) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
}

.info-banner--warning {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.info-banner__icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.info-banner__text {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* Edit mode cards */
.item-edit-card {
  display: flex;
  gap: var(--spacing-xs);
  align-items: flex-start;
  padding: var(--spacing-sm);
  background: var(--surface-hover);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.item-edit-card__fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.item-edit-card__numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-xs);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.form-input {
  width: 100%;
  padding: 0.4375rem var(--spacing-xs);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: inherit;
  color: var(--color-text-primary);
  background: var(--bg-white);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.remove-btn {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  width: 2.125rem;
  height: 2.125rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0.125rem;
  transition: all var(--transition-fast);
}

.remove-btn:hover {
  background: color-mix(in srgb, var(--color-danger) 18%, transparent);
  border-color: var(--color-danger);
}

.add-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  background: transparent;
  color: var(--color-primary);
  border: 1.5px dashed var(--border-default);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.add-item-btn:hover {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  border-color: var(--color-primary);
}

/* Footer */
.modal-footer {
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

/* Buttons */
.modal-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem var(--spacing-md);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.modal-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-btn--primary {
  background: var(--gradient-primary);
  color: var(--color-text-white);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.modal-btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 40%, transparent);
}

.modal-btn--success {
  background: var(--gradient-success);
  color: var(--color-text-white);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-success) 30%, transparent);
}

.modal-btn--success:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-success) 40%, transparent);
}

.modal-btn--warning {
  background: var(--gradient-warning);
  color: var(--color-text-white);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.modal-btn--warning:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-warning) 40%, transparent);
}

.modal-btn--ghost {
  background: var(--vt-c-gray-100);
  color: var(--color-text-secondary);
  border: 1px solid var(--border-light);
}

.modal-btn--ghost:hover:not(:disabled) {
  background: var(--vt-c-gray-200);
}
</style>
