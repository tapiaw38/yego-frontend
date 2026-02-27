<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { useRoute } from "vue-router";
  import { profileService } from "../api/profileService";
  import MapboxPicker from "../components/MapboxPicker.vue";

  const route = useRoute();

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

  const token = computed(() => route.params.token as string);
  const loading = ref(true);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);
  const userId = ref<string | null>(null);

  // Country codes
  const countries = [
    { code: "AR", name: "Argentina", dialCode: "+54 9", flag: "🇦🇷" },
    { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
    { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
    { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
    { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷" },
    { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽" },
    { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
    { code: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪" },
    { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
    { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
    { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
    { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸" },
    { code: "ES", name: "España", dialCode: "+34", flag: "🇪🇸" },
  ];

  // Form data
  const selectedCountry = ref(countries[0]); // Argentina por defecto
  const phoneNumber = ref("");
  const location = ref<{ lng: number; lat: number } | null>(null);
  const address = ref("");

  // Full phone number with country code
  const fullPhoneNumber = computed(() => {
    if (!phoneNumber.value || !selectedCountry.value) return "";
    const cleanNumber = phoneNumber.value.replace(/\D/g, "");
    return `${selectedCountry.value.dialCode}${cleanNumber}`;
  });

  const validateToken = async () => {
    try {
      const result = await profileService.validateToken(token.value);
      if (result.valid) {
        userId.value = result.user_id;
        error.value = null;
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message ||
        "El enlace no es válido o ha expirado";
    } finally {
      loading.value = false;
    }
  };

  const handleAddressChange = (newAddress: string) => {
    address.value = newAddress;
  };

  const handleSubmit = async () => {
    if (!location.value || !phoneNumber.value) {
      error.value = "Por favor completa todos los campos";
      return;
    }

    submitting.value = true;
    error.value = null;

    try {
      await profileService.completeProfile({
        token: token.value,
        phone_number: fullPhoneNumber.value,
        longitude: location.value.lng,
        latitude: location.value.lat,
        address: address.value,
      });
      success.value = true;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message || "Error al guardar el perfil";
    } finally {
      submitting.value = false;
    }
  };

  onMounted(() => {
    validateToken();
  });
</script>

<template>
  <div class="profile-view">
    <header class="profile-header">
      <div class="profile-header__brand">
        <div class="profile-header__logo">
          <i class="pi pi-user"></i>
        </div>
        <h1 class="profile-header__title">Completar Perfil</h1>
      </div>
    </header>

    <main class="profile-main">
      <!-- Loading State -->
      <div v-if="loading" class="feedback-state">
        <div class="feedback-state__spinner"></div>
        <p class="feedback-state__text">Verificando enlace...</p>
      </div>

      <!-- Error State (Invalid Token) -->
      <div v-else-if="error && !userId" class="feedback-state feedback-state--card card-modern">
        <div class="feedback-state__icon feedback-state__icon--error">
          <i class="pi pi-link"></i>
        </div>
        <h2 class="feedback-state__title">Enlace inválido</h2>
        <p class="feedback-state__message">{{ error }}</p>
        <p class="feedback-state__hint">Solicita un nuevo enlace por WhatsApp</p>
      </div>

      <!-- Success State -->
      <div v-else-if="success" class="feedback-state feedback-state--card card-modern">
        <div class="feedback-state__icon feedback-state__icon--success">
          <i class="pi pi-check-circle"></i>
        </div>
        <h2 class="feedback-state__title">Perfil completado</h2>
        <p class="feedback-state__message">Tu información ha sido guardada correctamente.</p>
        <p class="feedback-state__hint">Ya puedes cerrar esta página</p>
      </div>

      <!-- Form -->
      <div v-else class="form-card card-modern">
        <p class="form-intro">
          Completa tu información para que podamos enviarte tus pedidos
        </p>

        <form @submit.prevent="handleSubmit" class="profile-form">
          <!-- Phone Number with Country Selector -->
          <div class="form-field">
            <label class="form-field__label" for="phone">Número de teléfono</label>
            <div class="phone-row">
              <select v-model="selectedCountry" class="country-select">
                <option
                  v-for="country in countries"
                  :key="country.code"
                  :value="country"
                >
                  {{ country.flag }} {{ country.dialCode }}
                </option>
              </select>
              <input
                id="phone"
                v-model="phoneNumber"
                type="tel"
                placeholder="11 1234-5678"
                required
                class="form-input phone-input"
              />
            </div>
            <span class="phone-preview" v-if="phoneNumber">
              <i class="pi pi-phone"></i> {{ fullPhoneNumber }}
            </span>
          </div>

          <!-- Location Map -->
          <div class="form-field">
            <label class="form-field__label">Ubicación de entrega</label>
            <MapboxPicker
              v-model="location"
              :access-token="MAPBOX_TOKEN"
              @address-change="handleAddressChange"
            />
          </div>

          <!-- Address (auto-filled from map) -->
          <div class="form-field">
            <label class="form-field__label" for="address">Dirección</label>
            <input
              id="address"
              v-model="address"
              type="text"
              placeholder="Se completará automáticamente al seleccionar en el mapa"
              class="form-input form-input--readonly"
              readonly
            />
          </div>

          <!-- Coordinates display -->
          <div v-if="location" class="coordinates-pill">
            <i class="pi pi-map-marker"></i>
            <span>{{ location.lat.toFixed(6) }}, {{ location.lng.toFixed(6) }}</span>
          </div>

          <!-- Error message -->
          <div v-if="error" class="alert-error">
            <i class="pi pi-exclamation-circle"></i>
            {{ error }}
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            class="action-btn action-btn--primary"
            :disabled="submitting || !location || !phoneNumber"
          >
            <i v-if="submitting" class="pi pi-spin pi-spinner"></i>
            <span>{{ submitting ? "Guardando..." : "Guardar perfil" }}</span>
          </button>
        </form>
      </div>
    </main>

    <footer class="profile-footer">
      <p>Powered by Gillie AI</p>
    </footer>
  </div>
</template>

<style scoped>
  .profile-view {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--surface-ground);
  }

  /* Header */
  .profile-header {
    background: var(--bg-white);
    padding: var(--spacing-md) var(--spacing-lg);
    box-shadow: var(--shadow-light);
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid var(--border-light);
  }

  .profile-header__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }

  .profile-header__logo {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-sm);
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-white);
    font-size: 1rem;
    flex-shrink: 0;
  }

  .profile-header__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  /* Main content */
  .profile-main {
    flex: 1;
    padding: var(--spacing-lg) var(--spacing-md);
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
  }

  /* Feedback states */
  .feedback-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-lg);
    text-align: center;
    gap: var(--spacing-sm);
  }

  .feedback-state--card {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-2xl);
  }

  .feedback-state__spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .feedback-state__text {
    color: var(--color-text-muted);
    margin: 0;
  }

  .feedback-state__icon {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin-bottom: var(--spacing-xs);
  }

  .feedback-state__icon--error {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger);
  }

  .feedback-state__icon--success {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success);
  }

  .feedback-state__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .feedback-state__message {
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .feedback-state__hint {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin: 0;
    font-style: italic;
  }

  /* Form card */
  .form-card {
    padding: var(--spacing-xl);
    animation: fadeSlide 0.25s ease;
  }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .form-intro {
    text-align: center;
    color: var(--color-text-muted);
    margin: 0 0 var(--spacing-lg);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .profile-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  /* Form field */
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

  /* Phone */
  .phone-row {
    display: flex;
    gap: var(--spacing-sm);
  }

  .country-select {
    padding: 0.75rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.9375rem;
    background: var(--bg-white);
    color: var(--color-text-primary);
    cursor: pointer;
    min-width: 110px;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .country-select:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .phone-preview {
    font-size: 0.8125rem;
    color: var(--color-primary);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .phone-input {
    flex: 1;
  }

  /* Input */
  .form-input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.9375rem;
    background: var(--bg-white);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    width: 100%;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .form-input--readonly {
    background: var(--bg-light);
    color: var(--color-text-muted);
    cursor: default;
  }

  .form-input--readonly:focus {
    box-shadow: none;
    border-color: var(--border-default);
  }

  /* Coordinates */
  .coordinates-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-light);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-light);
  }

  .coordinates-pill i {
    color: var(--color-primary);
  }

  /* Error alert */
  .alert-error {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-sm);
    color: var(--color-danger-dark);
    font-size: 0.875rem;
  }

  /* Submit button */
  .action-btn {
    padding: 0.9375rem var(--spacing-md);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    width: 100%;
  }

  .action-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .action-btn--primary {
    background: var(--gradient-primary);
    color: var(--color-text-white);
  }

  .action-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: var(--shadow-medium);
  }

  .action-btn--primary:active:not(:disabled) {
    transform: translateY(0);
  }

  /* Footer */
  .profile-footer {
    background: var(--bg-white);
    padding: var(--spacing-md);
    text-align: center;
    border-top: 1px solid var(--border-light);
  }

  .profile-footer p {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .profile-main {
      padding: var(--spacing-md) var(--spacing-sm);
    }

    .form-card {
      padding: var(--spacing-lg) var(--spacing-md);
    }

    .profile-form {
      gap: var(--spacing-md);
    }

    .phone-row {
      flex-direction: column;
    }

    .country-select {
      width: 100%;
    }
  }
</style>
