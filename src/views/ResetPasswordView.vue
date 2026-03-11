<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authService } from "@/api/authService";
import yegoLogo from "../assets/img/yego-logo.png";

const router = useRouter();
const route = useRoute();

const token = computed(() => route.query.token as string);

const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const error = ref("");
const success = ref(false);

const passwordError = computed(() => {
  const p = password.value;
  if (!p) return "";
  if (p.length < 8) return "Debe tener al menos 8 caracteres";
  if (!/[A-Z]/.test(p)) return "Debe contener al menos una letra mayuscula";
  if (!/[a-z]/.test(p)) return "Debe contener al menos una letra minuscula";
  if (!/[0-9]/.test(p)) return "Debe contener al menos un numero";
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p))
    return "Debe contener al menos un caracter especial (!@#$%^&*...)";
  return "";
});

const confirmPasswordError = computed(() => {
  if (!confirmPassword.value) return "";
  return confirmPassword.value === password.value ? "" : "Las contrasenas no coinciden";
});

const isValid = computed(() =>
  token.value && password.value && confirmPassword.value &&
  !passwordError.value && !confirmPasswordError.value
);

const handleSubmit = async () => {
  if (!isValid.value) return;
  loading.value = true;
  error.value = "";
  try {
    await authService.resetPassword(token.value, password.value);
    success.value = true;
    setTimeout(() => router.push("/login"), 2500);
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    error.value = e.response?.data?.message || "Error al restablecer la contrasena";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="rp-container gradient-background">
    <div class="login-background" aria-hidden="true">
      <div class="login-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
      </div>
    </div>

    <div class="rp-content">
      <div class="login-header">
        <div class="logo-container">
          <img :src="yegoLogo" alt="Yego" class="logo-img" />
        </div>
        <p class="login-subtitle">Restablecer contrasena</p>
      </div>

      <div class="login-card">
        <div class="form-header">
          <div class="form-icon gradient-primary">
            <i class="pi pi-lock text-white"></i>
          </div>
          <h2 class="form-title">Nueva Contrasena</h2>
        </div>

        <!-- Invalid token -->
        <div v-if="!token" class="form-error">
          <i class="pi pi-exclamation-triangle"></i>
          Token invalido o no proporcionado. Solicita un nuevo enlace de recuperacion.
        </div>

        <!-- Success -->
        <div v-else-if="success" class="rp-success">
          <i class="pi pi-check-circle"></i>
          <p>Contrasena restablecida correctamente</p>
          <small>Seras redirigido al inicio de sesion...</small>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleSubmit" class="auth-form">
          <div class="form-group">
            <label for="rp-password">Nueva contrasena</label>
            <input
              id="rp-password"
              v-model="password"
              type="password"
              placeholder="Min 8 caracteres, mayus, num y especial"
              class="form-input"
              :class="{ 'input-error': passwordError }"
              required
            />
            <small v-if="passwordError" class="error-text text-danger">{{ passwordError }}</small>
          </div>

          <div class="form-group">
            <label for="rp-confirm">Confirmar contrasena</label>
            <input
              id="rp-confirm"
              v-model="confirmPassword"
              type="password"
              placeholder="Repite la nueva contrasena"
              class="form-input"
              :class="{ 'input-error': confirmPasswordError }"
              required
            />
            <small v-if="confirmPasswordError" class="error-text text-danger">{{ confirmPasswordError }}</small>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <button
            type="submit"
            class="submit-button btn-primary"
            :disabled="loading || !isValid"
          >
            <span v-if="loading">Restableciendo...</span>
            <span v-else>Restablecer Contrasena</span>
          </button>

          <button
            type="button"
            class="toggle-button text-primary back-link"
            @click="router.push('/login')"
          >
            <i class="pi pi-arrow-left"></i> Volver al inicio de sesion
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rp-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.login-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.login-shapes {
  position: relative;
  width: 100%;
  height: 100%;
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

.rp-content {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  padding: var(--spacing-xl);
}

.login-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-xs);
}

.logo-img {
  height: 80px;
  width: auto;
  filter: drop-shadow(0 4px 12px var(--shadow-heavy));
}

.login-subtitle {
  font-size: 1rem;
  color: var(--color-text-white-muted);
  margin: 0;
}

.login-card {
  background: var(--surface-card);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  box-shadow: 0 25px 50px var(--shadow-heavy);
}

.form-header {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.form-icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  margin: 0 auto var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  box-shadow: 0 8px 32px var(--shadow-medium);
}

.form-title {
  font-size: 1.5rem;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.form-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 1rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  outline: none;
  background: var(--bg-white);
  color: var(--color-text-primary);
  width: 100%;
}

.form-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.form-input.input-error {
  border-color: var(--color-danger);
}

.error-text {
  font-size: 0.75rem;
}

.form-error {
  color: var(--color-danger-dark);
  font-size: 0.875rem;
  text-align: center;
  padding: var(--spacing-sm);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-danger-light);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.submit-button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-xs);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-button {
  background: none;
  border: none;
  font-weight: var(--font-semibold);
  cursor: pointer;
  padding: 0;
  font-size: inherit;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.rp-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  color: var(--color-success-dark);
  text-align: center;
}

.rp-success i {
  font-size: 2.5rem;
}

.rp-success p {
  margin: 0;
  font-weight: 500;
}

.rp-success small {
  color: var(--color-text-muted);
}

@media (max-width: 480px) {
  .rp-content {
    padding: var(--spacing-md);
  }

  .login-card {
    padding: var(--spacing-lg);
  }
}
</style>
