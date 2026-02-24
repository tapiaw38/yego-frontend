<script setup lang="ts">
  import { ref, computed } from "vue";
  import { useRouter, useRoute } from "vue-router";
  import { useAuth } from "@/composables/useAuth";
  import GoogleButton from "../components/GoogleButton.vue";
  import yegoLogo from "../assets/img/yego-logo.png";

  const router = useRouter();
  const route = useRoute();

  const {
    loginUser,
    registerUser,
    isLoginPending,
    isRegisterPending,
    loginError,
    registerError,
  } = useAuth();

  const redirectUrl = computed(() => {
    return (route.query.redirect as string) || "/profile";
  });

  type ViewMode = "login" | "register";
  const currentView = ref<ViewMode>("login");

  const email = ref("");
  const password = ref("");
  const firstName = ref("");
  const lastName = ref("");
  const confirmPassword = ref("");

  const loading = computed(
    () => isLoginPending.value || isRegisterPending.value,
  );
  const error = computed(
    () => loginError.value?.message || registerError.value?.message || null,
  );

  // Validation
  const emailError = computed(() => {
    if (!email.value) return "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.value) ? "" : "Email invalido";
  });

  const passwordError = computed(() => {
    if (!password.value) return "";
    return password.value.length >= 6
      ? ""
      : "La contrasena debe tener al menos 6 caracteres";
  });

  const confirmPasswordError = computed(() => {
    if (!confirmPassword.value) return "";
    return confirmPassword.value === password.value
      ? ""
      : "Las contrasenas no coinciden";
  });

  const isLoginValid = computed(() => {
    return (
      email.value && password.value && !emailError.value && !passwordError.value
    );
  });

  const isRegisterValid = computed(() => {
    return (
      firstName.value &&
      lastName.value &&
      email.value &&
      password.value &&
      confirmPassword.value &&
      !emailError.value &&
      !passwordError.value &&
      !confirmPasswordError.value
    );
  });

  const toggleView = () => {
    currentView.value = currentView.value === "login" ? "register" : "login";
    email.value = "";
    password.value = "";
    firstName.value = "";
    lastName.value = "";
    confirmPassword.value = "";
  };

  const handleLogin = async () => {
    if (!isLoginValid.value) return;

    try {
      await loginUser({
        email: email.value,
        password: password.value,
      });
      await router.push(redirectUrl.value);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleRegister = async () => {
    if (!isRegisterValid.value) return;

    try {
      await registerUser({
        first_name: firstName.value,
        last_name: lastName.value,
        email: email.value,
        password: password.value,
      });
      currentView.value = "login";
      password.value = "";
      confirmPassword.value = "";
      firstName.value = "";
      lastName.value = "";
    } catch (err) {
      console.error("Register error:", err);
    }
  };

  const handleGoogleLogin = async (code: string) => {
    try {
      await loginUser({
        ssoType: "google",
        ssoCode: code,
      });
      await router.push(redirectUrl.value);
    } catch (err) {
      console.error("Google login error:", err);
    }
  };
</script>

<template>
  <div class="login-container">
    <div class="login-background">
      <div class="login-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
      </div>
    </div>

    <div class="login-content">
      <div class="login-header">
        <div class="logo-container">
          <img :src="yegoLogo" alt="Yego" class="logo-img" />
        </div>
        <p class="login-subtitle">
          {{
            currentView === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"
          }}
        </p>
      </div>

      <div class="login-card">
        <div class="form-header">
          <div class="form-icon">
            <i v-if="currentView === 'login'" class="pi pi-lock"></i>
            <i v-else class="pi pi-user-plus"></i>
          </div>
          <h2 class="form-title">
            {{ currentView === "login" ? "Iniciar Sesion" : "Crear Cuenta" }}
          </h2>
        </div>

        <!-- Login Form -->
        <form
          v-if="currentView === 'login'"
          @submit.prevent="handleLogin"
          class="auth-form"
        >
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="tu@email.com"
              class="form-input"
              :class="{ 'input-error': emailError }"
              required
            />
            <small v-if="emailError" class="error-text">{{ emailError }}</small>
          </div>

          <div class="form-group">
            <label for="password">Contrasena</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="Tu contrasena"
              class="form-input"
              :class="{ 'input-error': passwordError }"
              required
            />
            <small v-if="passwordError" class="error-text">{{
              passwordError
            }}</small>
          </div>

          <div v-if="error" class="form-error">
            {{ error }}
          </div>

          <button
            type="submit"
            class="submit-button"
            :disabled="loading || !isLoginValid"
          >
            <span v-if="loading">Iniciando sesion...</span>
            <span v-else>Iniciar Sesion</span>
          </button>
        </form>

        <!-- Register Form -->
        <form v-else @submit.prevent="handleRegister" class="auth-form">
          <div class="form-group">
            <label for="firstName">Nombre</label>
            <input
              id="firstName"
              v-model="firstName"
              type="text"
              placeholder="Tu nombre"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label for="lastName">Apellido</label>
            <input
              id="lastName"
              v-model="lastName"
              type="text"
              placeholder="Tu apellido"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label for="registerEmail">Email</label>
            <input
              id="registerEmail"
              v-model="email"
              type="email"
              placeholder="tu@email.com"
              class="form-input"
              :class="{ 'input-error': emailError }"
              required
            />
            <small v-if="emailError" class="error-text">{{ emailError }}</small>
          </div>

          <div class="form-group">
            <label for="registerPassword">Contrasena</label>
            <input
              id="registerPassword"
              v-model="password"
              type="password"
              placeholder="Minimo 6 caracteres"
              class="form-input"
              :class="{ 'input-error': passwordError }"
              required
            />
            <small v-if="passwordError" class="error-text">{{
              passwordError
            }}</small>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar Contrasena</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="Repite tu contrasena"
              class="form-input"
              :class="{ 'input-error': confirmPasswordError }"
              required
            />
            <small v-if="confirmPasswordError" class="error-text">{{
              confirmPasswordError
            }}</small>
          </div>

          <div v-if="error" class="form-error">
            {{ error }}
          </div>

          <button
            type="submit"
            class="submit-button"
            :disabled="loading || !isRegisterValid"
          >
            <span v-if="loading">Registrando...</span>
            <span v-else>Crear Cuenta</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="divider">
          <span class="divider-text">o continua con</span>
        </div>

        <!-- Google Button -->
        <div class="social-login">
          <GoogleButton @code="handleGoogleLogin" />
        </div>

        <div class="form-footer">
          <p class="toggle-text">
            {{
              currentView === "login"
                ? "No tienes una cuenta?"
                : "Ya tienes una cuenta?"
            }}
            <button type="button" class="toggle-button" @click="toggleView">
              {{ currentView === "login" ? "Crear cuenta" : "Iniciar sesion" }}
            </button>
          </p>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div v-if="loading" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text">
            {{
              currentView === "login" ? "Iniciando sesion..." : "Registrando..."
            }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .login-container {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background: var(--gradient-background);
  }

  /* Animated Background */
  .login-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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
    animation: float 6s ease-in-out infinite;
    border-radius: 50%;
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
    0%,
    100% {
      transform: translateY(0px) rotate(0deg);
    }
    50% {
      transform: translateY(-20px) rotate(10deg);
    }
  }

  /* Main Content */
  .login-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 420px;
    padding: 2rem;
  }

  /* Header */
  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .logo-img {
    height: 80px;
    width: auto;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
  }

  .login-subtitle {
    font-size: 1rem;
    color: var(--color-text-white-muted);
    margin: 0;
  }

  /* Card */
  .login-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xl);
    box-shadow: 0 25px 50px var(--shadow-heavy);
    animation: slideUp 0.5s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Form Header */
  .form-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .form-icon {
    width: 3rem;
    height: 3rem;
    background: var(--gradient-primary);
    border-radius: var(--radius-md);
    margin: 0 auto 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-primary);
  }

  .form-icon span {
    font-size: 1.25rem;
  }

  .form-title {
    font-size: 1.5rem;
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: 0;
  }

  /* Form */
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
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
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    outline: none;
    background: var(--bg-white) !important;
    color: var(--color-text-primary) !important;
  }

  .form-input::placeholder {
    color: var(--color-text-placeholder) !important;
  }

  .form-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    background: var(--bg-white) !important;
    color: var(--color-text-primary) !important;
  }

  .form-input.input-error {
    border-color: var(--color-danger);
  }

  .error-text {
    color: var(--color-danger);
    font-size: 0.75rem;
  }

  .form-error {
    color: var(--color-danger-dark);
    font-size: 0.875rem;
    text-align: center;
    padding: var(--spacing-sm);
    background: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-danger-light);
  }

  .submit-button {
    background: var(--gradient-primary);
    color: var(--color-text-white);
    border: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    font-weight: var(--font-semibold);
    font-size: 1rem;
    cursor: pointer;
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      opacity var(--transition-fast);
    margin-top: var(--spacing-xs);
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-primary);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Form Footer */
  .form-footer {
    text-align: center;
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--vt-c-gray-200);
  }

  .toggle-text {
    color: var(--vt-c-gray-500);
    font-size: 0.875rem;
    margin: 0;
  }

  .toggle-button {
    background: none;
    border: none;
    color: var(--color-primary);
    font-weight: var(--font-semibold);
    cursor: pointer;
    padding: 0;
    margin-left: var(--spacing-xs);
  }

  .toggle-button:hover {
    text-decoration: underline;
  }

  /* Divider */
  .divider {
    position: relative;
    text-align: center;
    margin: 1.5rem 0;
  }

  .divider::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--vt-c-gray-200);
  }

  .divider-text {
    background: rgba(255, 255, 255, 0.95);
    padding: 0 var(--spacing-md);
    color: var(--vt-c-gray-500);
    font-size: 0.875rem;
    position: relative;
    z-index: 1;
  }

  /* Social Login */
  .social-login {
    margin-bottom: 1rem;
  }

  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .loading-content {
    background: var(--bg-white);
    padding: var(--spacing-xl);
    border-radius: var(--radius-xl);
    text-align: center;
    box-shadow: 0 25px 50px var(--shadow-heavy);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--vt-c-gray-200);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: var(--color-text-secondary);
    font-weight: var(--font-medium);
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .login-content {
      padding: 1rem;
    }

    .login-card {
      padding: 1.5rem;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .logo-text {
      font-size: 1.5rem;
    }
  }
</style>
