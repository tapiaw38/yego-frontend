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

  const registerPasswordError = computed(() => {
    const p = password.value;
    if (!p) return "";
    if (p.length < 8) return "La contrasena debe tener al menos 8 caracteres";
    if (!/[A-Z]/.test(p)) return "Debe contener al menos una letra mayuscula";
    if (!/[a-z]/.test(p)) return "Debe contener al menos una letra minuscula";
    if (!/[0-9]/.test(p)) return "Debe contener al menos un numero";
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p))
      return "Debe contener al menos un caracter especial (!@#$%^&*...)";
    return "";
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
      !registerPasswordError.value &&
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
  <div class="login-container gradient-background">
    <div class="login-background" aria-hidden="true">
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
          <div class="form-icon gradient-primary">
            <i
              v-if="currentView === 'login'"
              class="pi pi-lock text-white"
            ></i>
            <i v-else class="pi pi-user-plus text-white"></i>
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
            <small v-if="emailError" class="error-text text-danger">{{ emailError }}</small>
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
            <small v-if="passwordError" class="error-text text-danger">{{
              passwordError
            }}</small>
          </div>

          <div v-if="error" class="form-error">
            {{ error }}
          </div>

          <button
            type="submit"
            class="submit-button btn-primary"
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
            <small v-if="emailError" class="error-text text-danger">{{ emailError }}</small>
          </div>

          <div class="form-group">
            <label for="registerPassword">Contrasena</label>
            <input
              id="registerPassword"
              v-model="password"
              type="password"
              placeholder="Minimo 8 caracteres, mayus, num y especial"
              class="form-input"
              :class="{ 'input-error': registerPasswordError }"
              required
            />
            <small v-if="registerPasswordError" class="error-text text-danger">{{
              registerPasswordError
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
            <small v-if="confirmPasswordError" class="error-text text-danger">{{
              confirmPasswordError
            }}</small>
          </div>

          <div v-if="error" class="form-error">
            {{ error }}
          </div>

          <button
            type="submit"
            class="submit-button btn-primary"
            :disabled="loading || !isRegisterValid"
          >
            <span v-if="loading">Registrando...</span>
            <span v-else>Crear Cuenta</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="divider">
          <span class="divider-text text-gray-500">o continua con</span>
        </div>

        <!-- Google Button -->
        <div class="social-login">
          <GoogleButton @code="handleGoogleLogin" />
        </div>

        <div class="form-footer">
          <p class="toggle-text text-gray-500">
            {{
              currentView === "login"
                ? "No tienes una cuenta?"
                : "Ya tienes una cuenta?"
            }}
            <button type="button" class="toggle-button text-primary" @click="toggleView">
              {{ currentView === "login" ? "Crear cuenta" : "Iniciar sesion" }}
            </button>
          </p>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div v-if="loading" class="loading-overlay" role="status" aria-live="polite">
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-text text-gray-600">
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
  /* Layout */
  .login-container {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  /* Animated Background Shapes */
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
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-20px) rotate(10deg); }
  }

  /* Main Content */
  .login-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 420px;
    padding: var(--spacing-xl);
  }

  /* Header */
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

  /* Card */
  .login-card {
    background: var(--surface-card);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xl);
    box-shadow: 0 25px 50px var(--shadow-heavy);
    animation: slideUp 0.5s ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Form Header */
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

  /* Form */
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
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    outline: none;
    background: var(--bg-white);
    color: var(--color-text-primary);
    width: 100%;
  }

  .form-input::placeholder {
    color: var(--color-text-placeholder);
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
  }

  /* Submit — overrides btn-primary sizing for full width */
  .submit-button {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    margin-top: var(--spacing-xs);
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Divider */
  .divider {
    position: relative;
    text-align: center;
    margin: var(--spacing-lg) 0;
  }

  .divider::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border-light);
  }

  .divider-text {
    background: var(--surface-card);
    padding: 0 var(--spacing-md);
    font-size: 0.875rem;
    position: relative;
    z-index: 1;
  }

  /* Social Login */
  .social-login {
    margin-bottom: var(--spacing-md);
  }

  /* Form Footer */
  .form-footer {
    text-align: center;
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-light);
  }

  .toggle-text {
    font-size: 0.875rem;
    margin: 0;
  }

  .toggle-button {
    background: none;
    border: none;
    font-weight: var(--font-semibold);
    cursor: pointer;
    padding: 0;
    margin-left: var(--spacing-xs);
    font-size: inherit;
  }

  .toggle-button:hover {
    text-decoration: underline;
  }

  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: var(--shadow-medium);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .loading-content {
    background: var(--surface-card);
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
    border: 4px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    font-weight: var(--font-medium);
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .login-content {
      padding: var(--spacing-md);
    }

    .login-card {
      padding: var(--spacing-lg);
    }
  }
</style>
