<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { authService } from '@/api/authService'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const oldPassword = ref('')
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
  if (p === oldPassword.value) return 'La nueva contrasena debe ser diferente a la actual'
  return ''
})

const confirmPasswordError = computed(() => {
  if (!confirmPassword.value) return ''
  return confirmPassword.value === newPassword.value ? '' : 'Las contrasenas no coinciden'
})

const isValid = computed(() =>
  oldPassword.value &&
  newPassword.value &&
  confirmPassword.value &&
  !newPasswordError.value &&
  !confirmPasswordError.value
)

const reset = () => {
  oldPassword.value = ''
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
    await authService.changePassword(oldPassword.value, newPassword.value)
    success.value = true
    setTimeout(handleClose, 1500)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    error.value = e.response?.data?.message || 'Error al cambiar la contrasena'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    header="Cambiar Contrasena"
    :style="{ width: '380px' }"
    :draggable="false"
    @update:visible="handleClose"
  >
    <div v-if="success" class="cp-success">
      <i class="pi pi-check-circle"></i>
      <p>Contrasena actualizada correctamente</p>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="cp-form">
      <div class="cp-group">
        <label>Contrasena actual</label>
        <input v-model="oldPassword" type="password" class="cp-input" placeholder="Tu contrasena actual" />
      </div>

      <div class="cp-group">
        <label>Nueva contrasena</label>
        <input
          v-model="newPassword"
          type="password"
          class="cp-input"
          :class="{ 'cp-input-error': newPasswordError }"
          placeholder="Min 8 caracteres, mayus, num y especial"
        />
        <small v-if="newPasswordError" class="cp-error">{{ newPasswordError }}</small>
      </div>

      <div class="cp-group">
        <label>Confirmar nueva contrasena</label>
        <input
          v-model="confirmPassword"
          type="password"
          class="cp-input"
          :class="{ 'cp-input-error': confirmPasswordError }"
          placeholder="Repite la nueva contrasena"
        />
        <small v-if="confirmPasswordError" class="cp-error">{{ confirmPasswordError }}</small>
      </div>

      <div v-if="error" class="cp-alert">{{ error }}</div>

      <div class="cp-actions">
        <Button type="button" label="Cancelar" text @click="handleClose" :disabled="loading" />
        <Button type="submit" label="Guardar" :loading="loading" :disabled="!isValid || loading" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.cp-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cp-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.cp-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.cp-input {
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

.cp-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.cp-input-error {
  border-color: var(--color-danger);
}

.cp-error {
  font-size: 0.75rem;
  color: var(--color-danger);
}

.cp-alert {
  font-size: 0.875rem;
  color: var(--color-danger-dark);
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
  border-radius: var(--radius-md);
}

.cp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.cp-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  color: var(--color-success-dark);
  text-align: center;
}

.cp-success i {
  font-size: 2.5rem;
}

.cp-success p {
  margin: 0;
  font-weight: 500;
}
</style>
