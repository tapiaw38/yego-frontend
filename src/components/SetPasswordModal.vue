<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { authService } from '@/api/authService'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; success: [] }>()

const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const newPasswordError = computed(() => {
  const p = newPassword.value
  if (!p) return ''
  if (p.length < 8) return 'Debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(p)) return 'Debe contener al menos una letra mayuscula'
  if (!/[a-z]/.test(p)) return 'Debe contener al menos una letra minuscula'
  if (!/[0-9]/.test(p)) return 'Debe contener al menos un numero'
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p))
    return 'Debe contener al menos un caracter especial (!@#$%^&*...)'
  return ''
})

const confirmPasswordError = computed(() => {
  if (!confirmPassword.value) return ''
  return confirmPassword.value === newPassword.value ? '' : 'Las contrasenas no coinciden'
})

const isValid = computed(() =>
  newPassword.value &&
  confirmPassword.value &&
  !newPasswordError.value &&
  !confirmPasswordError.value
)

const reset = () => {
  newPassword.value = ''
  confirmPassword.value = ''
  error.value = ''
  success.value = false
  loading.value = false
}

const handleClose = () => {
  reset()
  emit('update:visible', false)
}

const handleSubmit = async () => {
  if (!isValid.value) return
  loading.value = true
  error.value = ''
  try {
    await authService.setPassword(newPassword.value)
    success.value = true
    emit('success')
    setTimeout(handleClose, 1500)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Error al establecer la contrasena'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    header="Establecer Contrasena"
    :style="{ width: '380px' }"
    :draggable="false"
    @update:visible="handleClose"
  >
    <div v-if="success" class="sp-success">
      <i class="pi pi-check-circle"></i>
      <p>Contrasena establecida correctamente</p>
      <small>Ahora puedes iniciar sesion con email y contrasena</small>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="sp-form">
      <p class="sp-info">
        <i class="pi pi-info-circle"></i>
        Tu cuenta usa Google. Establece una contrasena para poder iniciar sesion con email tambien.
      </p>

      <div class="sp-group">
        <label>Nueva contrasena</label>
        <input
          v-model="newPassword"
          type="password"
          class="sp-input"
          :class="{ 'sp-input-error': newPasswordError }"
          placeholder="Min 8 caracteres, mayus, num y especial"
        />
        <small v-if="newPasswordError" class="sp-error">{{ newPasswordError }}</small>
      </div>

      <div class="sp-group">
        <label>Confirmar contrasena</label>
        <input
          v-model="confirmPassword"
          type="password"
          class="sp-input"
          :class="{ 'sp-input-error': confirmPasswordError }"
          placeholder="Repite la contrasena"
        />
        <small v-if="confirmPasswordError" class="sp-error">{{ confirmPasswordError }}</small>
      </div>

      <div v-if="error" class="sp-alert">{{ error }}</div>

      <div class="sp-actions">
        <Button type="button" label="Cancelar" text @click="handleClose" :disabled="loading" />
        <Button type="submit" label="Establecer" :loading="loading" :disabled="!isValid || loading" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.sp-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sp-info {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: var(--radius-md);
  padding: 0.625rem 0.75rem;
  margin: 0;
}

.sp-info i {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 1px;
}

.sp-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.sp-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.sp-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 1rem;
  outline: none;
  background: var(--bg-white);
  color: var(--color-text-primary);
  width: 100%;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.sp-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.sp-input-error {
  border-color: var(--color-danger);
}

.sp-error {
  font-size: 0.75rem;
  color: var(--color-danger);
}

.sp-alert {
  font-size: 0.875rem;
  color: var(--color-danger-dark);
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
  border-radius: var(--radius-md);
}

.sp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.sp-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  color: var(--color-success-dark);
  text-align: center;
}

.sp-success i {
  font-size: 2.5rem;
}

.sp-success p {
  margin: 0;
  font-weight: 500;
}

.sp-success small {
  color: var(--color-text-muted);
}
</style>
