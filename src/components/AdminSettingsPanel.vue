<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { settingsService } from '../api/settingsService'
import type { Settings } from '../types/settings'

const loading = ref(true)
const saving = ref(false)
const settings = ref<Settings | null>(null)
const error = ref('')
const successMessage = ref('')

// Form fields
const form = ref({
  business_name: '',
  business_latitude: 0,
  business_longitude: 0,
  default_map_latitude: 0,
  default_map_longitude: 0,
  default_map_zoom: 13,
  default_item_weight: 500,
  delivery_base_price: 500,
  delivery_price_per_km: 200,
  delivery_price_per_kg: 100,
  manager_collector_id: ''
})

const fetchSettings = async () => {
  loading.value = true
  error.value = ''
  try {
    settings.value = await settingsService.getSettings()
    // Populate form
    form.value = {
      business_name: settings.value.business_name || '',
      business_latitude: settings.value.business_latitude,
      business_longitude: settings.value.business_longitude,
      default_map_latitude: settings.value.default_map_latitude,
      default_map_longitude: settings.value.default_map_longitude,
      default_map_zoom: settings.value.default_map_zoom,
      default_item_weight: settings.value.default_item_weight,
      delivery_base_price: settings.value.delivery_base_price,
      delivery_price_per_km: settings.value.delivery_price_per_km,
      delivery_price_per_kg: settings.value.delivery_price_per_kg,
      manager_collector_id: settings.value.manager_collector_id || ''
    }
  } catch (err) {
    console.error('Error fetching settings:', err)
    error.value = 'Error al cargar la configuración'
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  error.value = ''
  successMessage.value = ''
  try {
    settings.value = await settingsService.updateSettings(form.value)
    successMessage.value = 'Configuración guardada correctamente'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    console.error('Error saving settings:', err)
    error.value = 'Error al guardar la configuración'
  } finally {
    saving.value = false
  }
}

const useCurrentLocation = async (field: 'business' | 'default_map') => {
  if (!navigator.geolocation) {
    error.value = 'Geolocalización no soportada'
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (field === 'business') {
        form.value.business_latitude = position.coords.latitude
        form.value.business_longitude = position.coords.longitude
      } else {
        form.value.default_map_latitude = position.coords.latitude
        form.value.default_map_longitude = position.coords.longitude
      }
    },
    (err) => {
      console.error('Error getting location:', err)
      error.value = 'Error al obtener ubicación'
    }
  )
}

const copyBusinessToDefault = () => {
  form.value.default_map_latitude = form.value.business_latitude
  form.value.default_map_longitude = form.value.business_longitude
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div class="settings-panel">

    <!-- Loading State -->
    <div v-if="loading" class="state-loading">
      <div class="state-loading__spinner"></div>
      <p class="text-gray-500">Cargando configuración...</p>
    </div>

    <!-- Fatal Error State -->
    <div v-else-if="error && !settings" class="state-error card-modern">
      <div class="state-error__icon-wrap">
        <i class="pi pi-exclamation-circle text-danger"></i>
      </div>
      <p class="state-error__message text-danger">{{ error }}</p>
      <button class="action-btn action-btn--primary" @click="fetchSettings">
        <i class="pi pi-refresh"></i> Reintentar
      </button>
    </div>

    <!-- Settings Form -->
    <form v-else @submit.prevent="saveSettings" class="settings-form" novalidate>

      <!-- Toast: Success -->
      <div v-if="successMessage" class="toast toast--success" role="status" aria-live="polite">
        <i class="pi pi-check-circle toast__icon"></i>
        <span>{{ successMessage }}</span>
      </div>

      <!-- Toast: Error -->
      <div v-if="error" class="toast toast--danger" role="alert">
        <i class="pi pi-times-circle toast__icon"></i>
        <span>{{ error }}</span>
      </div>

      <!-- Section: Business Info -->
      <section class="settings-section card-modern">
        <div class="settings-section__header">
          <div class="settings-section__icon-wrap settings-section__icon-wrap--primary">
            <i class="pi pi-building"></i>
          </div>
          <div>
            <h3 class="settings-section__title">Información del Negocio</h3>
            <p class="settings-section__desc text-gray-500">Datos generales de tu establecimiento.</p>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="business_name">Nombre del Negocio</label>
          <input
            id="business_name"
            v-model="form.business_name"
            type="text"
            placeholder="Mi Restaurante"
            class="form-input"
          />
        </div>
      </section>

      <!-- Section: Business Location -->
      <section class="settings-section card-modern">
        <div class="settings-section__header">
          <div class="settings-section__icon-wrap settings-section__icon-wrap--info">
            <i class="pi pi-map-marker"></i>
          </div>
          <div>
            <h3 class="settings-section__title">Ubicación del Negocio</h3>
            <p class="settings-section__desc text-gray-500">Punto de origen para calcular distancias de envío.</p>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="business_latitude">Latitud</label>
            <input id="business_latitude" v-model.number="form.business_latitude" type="number" step="0.000001" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="business_longitude">Longitud</label>
            <input id="business_longitude" v-model.number="form.business_longitude" type="number" step="0.000001" class="form-input" />
          </div>
        </div>

        <button type="button" class="action-btn action-btn--ghost" @click="useCurrentLocation('business')">
          <i class="pi pi-crosshairs"></i> Usar mi ubicación actual
        </button>
      </section>

      <!-- Section: Default Map -->
      <section class="settings-section card-modern">
        <div class="settings-section__header">
          <div class="settings-section__icon-wrap settings-section__icon-wrap--info">
            <i class="pi pi-map"></i>
          </div>
          <div>
            <h3 class="settings-section__title">Mapa por Defecto</h3>
            <p class="settings-section__desc text-gray-500">Punto inicial que verán los usuarios al agregar su dirección.</p>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="default_map_latitude">Latitud</label>
            <input id="default_map_latitude" v-model.number="form.default_map_latitude" type="number" step="0.000001" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="default_map_longitude">Longitud</label>
            <input id="default_map_longitude" v-model.number="form.default_map_longitude" type="number" step="0.000001" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label" for="default_map_zoom">Zoom</label>
            <input id="default_map_zoom" v-model.number="form.default_map_zoom" type="number" min="1" max="20" class="form-input" />
          </div>
        </div>

        <div class="btn-group">
          <button type="button" class="action-btn action-btn--ghost" @click="useCurrentLocation('default_map')">
            <i class="pi pi-crosshairs"></i> Usar mi ubicación
          </button>
          <button type="button" class="action-btn action-btn--ghost" @click="copyBusinessToDefault">
            <i class="pi pi-copy"></i> Copiar del negocio
          </button>
        </div>
      </section>

      <!-- Section: Weight -->
      <section class="settings-section card-modern">
        <div class="settings-section__header">
          <div class="settings-section__icon-wrap settings-section__icon-wrap--warning">
            <i class="pi pi-box"></i>
          </div>
          <div>
            <h3 class="settings-section__title">Peso de Productos</h3>
            <p class="settings-section__desc text-gray-500">Valor usado cuando un producto no tiene peso especificado.</p>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="default_item_weight">Peso por defecto (gramos)</label>
          <input id="default_item_weight" v-model.number="form.default_item_weight" type="number" min="0" class="form-input" />
          <span class="form-hint text-gray-400">Se aplica a ítems sin peso definido.</span>
        </div>
      </section>

      <!-- Section: Manager Account -->
      <section class="settings-section card-modern">
        <div class="settings-section__header">
          <div class="settings-section__icon-wrap settings-section__icon-wrap--primary">
            <i class="pi pi-credit-card"></i>
          </div>
          <div>
            <h3 class="settings-section__title">Cuenta del Manager</h3>
            <p class="settings-section__desc text-gray-500">
              Collector ID de MercadoPago donde se acreditarán los pagos de órdenes entregadas.
            </p>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="manager_collector_id">Collector ID de MercadoPago</label>
          <input
            id="manager_collector_id"
            v-model="form.manager_collector_id"
            type="text"
            placeholder="Ej: 123456789"
            class="form-input"
          />
          <span class="form-hint text-gray-400">Obtenible desde el panel de tu cuenta MercadoPago.</span>
        </div>
      </section>

      <!-- Section: Delivery Pricing -->
      <section class="settings-section card-modern">
        <div class="settings-section__header">
          <div class="settings-section__icon-wrap settings-section__icon-wrap--success">
            <i class="pi pi-truck"></i>
          </div>
          <div>
            <h3 class="settings-section__title">Tarifas de Envío</h3>
            <p class="settings-section__desc text-gray-500">
              Fórmula: <strong>Base + (Distancia x Precio/km) + (Peso x Precio/kg)</strong>
            </p>
          </div>
        </div>

        <div class="form-row pricing-row">
          <div class="form-group">
            <label class="form-label" for="delivery_base_price">Precio Base</label>
            <div class="input-prefixed">
              <span class="input-prefix text-gray-500">$</span>
              <input id="delivery_base_price" v-model.number="form.delivery_base_price" type="number" min="0" class="form-input" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="delivery_price_per_km">Por Km</label>
            <div class="input-prefixed">
              <span class="input-prefix text-gray-500">$</span>
              <input id="delivery_price_per_km" v-model.number="form.delivery_price_per_km" type="number" min="0" class="form-input" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="delivery_price_per_kg">Por Kg</label>
            <div class="input-prefixed">
              <span class="input-prefix text-gray-500">$</span>
              <input id="delivery_price_per_kg" v-model.number="form.delivery_price_per_kg" type="number" min="0" class="form-input" />
            </div>
          </div>
        </div>

        <!-- Example Calculation -->
        <div class="calc-example">
          <p class="calc-example__heading text-gray-600">
            <i class="pi pi-calculator"></i> Ejemplo: pedido de 2 kg a 5 km
          </p>
          <div class="calc-example__rows">
            <div class="calc-example__row">
              <span class="text-gray-500">Precio base</span>
              <span class="text-gray-700">{{ formatPrice(form.delivery_base_price) }}</span>
            </div>
            <div class="calc-example__row">
              <span class="text-gray-500">Distancia (5 km x {{ formatPrice(form.delivery_price_per_km) }})</span>
              <span class="text-gray-700">{{ formatPrice(5 * form.delivery_price_per_km) }}</span>
            </div>
            <div class="calc-example__row">
              <span class="text-gray-500">Peso (2 kg x {{ formatPrice(form.delivery_price_per_kg) }})</span>
              <span class="text-gray-700">{{ formatPrice(2 * form.delivery_price_per_kg) }}</span>
            </div>
            <div class="calc-example__row calc-example__row--total">
              <span class="text-gray-800">Total estimado</span>
              <span class="text-primary">
                {{ formatPrice(form.delivery_base_price + (5 * form.delivery_price_per_km) + (2 * form.delivery_price_per_kg)) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Submit -->
      <div class="form-actions">
        <button type="submit" class="action-btn action-btn--primary action-btn--lg" :disabled="saving">
          <i class="pi" :class="saving ? 'pi-spin pi-spinner' : 'pi-save'"></i>
          {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.settings-panel {
  max-width: 800px;
  margin: 0 auto;
}

/* Loading */
.state-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
}

.state-loading__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error state */
.state-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  text-align: center;
}

.state-error__icon-wrap {
  font-size: 2.5rem;
}

.state-error__message {
  font-size: 0.9375rem;
}

/* Toast notifications */
.toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid;
  font-size: 0.9rem;
  font-weight: 500;
  animation: slide-in var(--transition-normal);
}

.toast--success {
  background: color-mix(in srgb, var(--color-success) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
  color: var(--color-success-dark);
}

.toast--danger {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
  color: var(--color-danger-dark);
}

.toast__icon {
  font-size: 1.125rem;
  flex-shrink: 0;
}

@keyframes slide-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Form layout */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* Section card */
.settings-section {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.settings-section__header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
}

.settings-section__icon-wrap {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.settings-section__icon-wrap--primary {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.settings-section__icon-wrap--success {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  color: var(--color-success);
}

.settings-section__icon-wrap--warning {
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-warning);
}

.settings-section__icon-wrap--info {
  background: color-mix(in srgb, var(--color-info) 12%, transparent);
  color: var(--color-info);
}

.settings-section__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 0.125rem;
}

.settings-section__desc {
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* Form elements */
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

.form-input {
  width: 100%;
  padding: 0.625rem var(--spacing-sm);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
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

.form-hint {
  font-size: 0.75rem;
  line-height: 1.4;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--spacing-md);
}

.pricing-row {
  grid-template-columns: repeat(3, 1fr);
}

/* Prefixed input */
.input-prefixed {
  display: flex;
  align-items: stretch;
}

.input-prefix {
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-sm);
  background: var(--vt-c-gray-100);
  border: 1.5px solid var(--border-default);
  border-right: none;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  font-weight: 600;
  font-size: 0.9375rem;
  flex-shrink: 0;
}

.input-prefixed .form-input {
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

/* Calculation example */
.calc-example {
  background: var(--surface-hover);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.calc-example__heading {
  font-size: 0.8125rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.calc-example__rows {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.calc-example__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  padding: 0.2rem 0;
}

.calc-example__row--total {
  border-top: 1.5px solid var(--border-light);
  margin-top: 0.25rem;
  padding-top: var(--spacing-xs);
  font-weight: 700;
  font-size: 0.9375rem;
}

/* Button group */
.btn-group {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

/* Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
}

.action-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.action-btn--primary {
  background: var(--gradient-primary);
  color: var(--color-text-white);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.action-btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--color-primary) 40%, transparent);
}

.action-btn--ghost {
  background: var(--vt-c-gray-100);
  color: var(--color-text-secondary);
  border: 1.5px solid var(--border-light);
}

.action-btn--ghost:hover:not(:disabled) {
  background: var(--vt-c-gray-200);
  border-color: var(--border-default);
}

.action-btn--lg {
  padding: 0.75rem var(--spacing-xl);
  font-size: 1rem;
}

/* Form actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-xs);
}

/* Responsive */
@media (max-width: 640px) {
  .form-row,
  .pricing-row {
    grid-template-columns: 1fr;
  }

  .btn-group {
    flex-direction: column;
  }

  .action-btn--ghost {
    width: 100%;
  }

  .form-actions {
    justify-content: stretch;
  }

  .action-btn--lg {
    width: 100%;
  }
}
</style>
