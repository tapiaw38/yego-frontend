<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { profileService } from "../api/profileService";
  import type { Profile } from "../types/profile";
  import MapboxPicker from "../components/MapboxPicker.vue";

  const route = useRoute();
  const router = useRouter();

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

  const profileId = computed(() => route.params.id as string);
  const loading = ref(true);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);
  const profile = ref<Profile | null>(null);

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
  const selectedCountry = ref(countries[0]);
  const phoneNumber = ref("");
  const location = ref<{ lng: number; lat: number } | null>(null);
  const address = ref("");

  // Full phone number with country code
  const fullPhoneNumber = computed(() => {
    if (!phoneNumber.value || !selectedCountry.value) return "";
    const cleanNumber = phoneNumber.value.replace(/\D/g, "");
    return `${selectedCountry.value.dialCode}${cleanNumber}`;
  });

  // Parse existing phone number to extract country and number
  const parsePhoneNumber = (fullPhone: string) => {
    for (const country of countries) {
      if (fullPhone.startsWith(country.dialCode)) {
        selectedCountry.value = country;
        phoneNumber.value = fullPhone.replace(country.dialCode, "").trim();
        return;
      }
    }
    // Default: use the full number as is
    phoneNumber.value = fullPhone;
  };

  const loadProfile = async () => {
    try {
      profile.value = await profileService.getProfile(profileId.value);

      // Populate form with existing data
      if (profile.value.phone_number) {
        parsePhoneNumber(profile.value.phone_number);
      }

      if (profile.value.location) {
        location.value = {
          lng: profile.value.location.longitude,
          lat: profile.value.location.latitude,
        };
        address.value = profile.value.location.address;
      }

      error.value = null;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message || "No se pudo cargar el perfil";
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
      await profileService.updateProfile(profileId.value, {
        phone_number: fullPhoneNumber.value,
        longitude: location.value.lng,
        latitude: location.value.lat,
        address: address.value,
      });
      success.value = true;

      // Redirect back after 2 seconds
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message || "Error al actualizar el perfil";
    } finally {
      submitting.value = false;
    }
  };

  const goBack = () => {
    router.back();
  };

  onMounted(() => {
    loadProfile();
  });
</script>

<template>
  <div class="edit-profile-view">
    <header class="app-header">
      <button @click="goBack" class="back-button">← Volver</button>
      <h1 class="app-title">Editar Datos de Entrega</h1>
    </header>

    <main class="main-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando perfil...</p>
      </div>

      <!-- Error State (Profile not found) -->
      <div v-else-if="error && !profile" class="error-state">
        <div class="error-icon"><i class="pi pi-exclamation-triangle"></i></div>
        <h2>Perfil no encontrado</h2>
        <p>{{ error }}</p>
        <button @click="goBack" class="retry-button">Volver</button>
      </div>

      <!-- Success State -->
      <div v-else-if="success" class="success-state">
        <div class="success-icon"><i class="pi pi-check-circle"></i></div>
        <h2>Datos actualizados</h2>
        <p>Tu información ha sido guardada correctamente.</p>
        <p class="hint">Regresando...</p>
      </div>

      <!-- Form -->
      <div v-else class="form-container">
        <p class="form-intro">Actualiza tu información de entrega</p>

        <form @submit.prevent="handleSubmit" class="profile-form">
          <!-- Phone Number with Country Selector -->
          <div class="form-group">
            <label for="phone">Número de teléfono</label>
            <div class="phone-input-container">
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
              {{ fullPhoneNumber }}
            </span>
          </div>

          <!-- Location Map -->
          <div class="form-group">
            <label>Ubicación de entrega</label>
            <MapboxPicker
              v-model="location"
              :access-token="MAPBOX_TOKEN"
              @address-change="handleAddressChange"
            />
          </div>

          <!-- Address (auto-filled from map) -->
          <div class="form-group">
            <label for="address">Dirección</label>
            <input
              id="address"
              v-model="address"
              type="text"
              placeholder="Se completará automáticamente al seleccionar en el mapa"
              class="form-input"
              readonly
            />
          </div>

          <!-- Coordinates display -->
          <div v-if="location" class="coordinates-display">
            <span
              ><i class="pi pi-map-marker"></i> {{ location.lat.toFixed(6) }},
              {{ location.lng.toFixed(6) }}</span
            >
          </div>

          <!-- Error message -->
          <div v-if="error" class="form-error">
            {{ error }}
          </div>

          <!-- Buttons -->
          <div class="button-group">
            <button
              type="button"
              class="cancel-button"
              @click="goBack"
              :disabled="submitting"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="submit-button"
              :disabled="submitting || !location || !phoneNumber"
            >
              <span v-if="submitting">Guardando...</span>
              <span v-else>Guardar cambios</span>
            </button>
          </div>
        </form>
      </div>
    </main>

    <footer class="app-footer">
      <p>Powered by Gillie AI</p>
    </footer>
  </div>
</template>

<style scoped>
  .edit-profile-view {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
  }

  .app-header {
    background: white;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .back-button {
    background: none;
    border: none;
    color: #667eea;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.5rem;
  }

  .back-button:hover {
    color: #5a67d8;
  }

  .app-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    flex: 1;
  }

  .main-content {
    flex: 1;
    padding: 1rem;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
  }

  .loading-state,
  .error-state,
  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-icon,
  .success-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .error-state h2,
  .success-state h2 {
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .error-state p,
  .success-state p {
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  .hint {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .form-container {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .form-intro {
    text-align: center;
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  .profile-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }

  .phone-input-container {
    display: flex;
    gap: 0.5rem;
  }

  .country-select {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
    cursor: pointer;
    min-width: 110px;
  }

  .country-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .phone-input {
    flex: 1;
  }

  .phone-preview {
    font-size: 0.75rem;
    color: #667eea;
    font-weight: 500;
  }

  .form-input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-default);
    border-radius: 8px;
    font-size: 1rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    background: var(--bg-white) !important;
    color: var(--color-text-primary) !important;
  }

  .form-input::placeholder {
    color: var(--color-text-placeholder) !important;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: var(--bg-white) !important;
    color: var(--color-text-primary) !important;
  }

  .form-input[readonly] {
    background: var(--bg-lighter) !important;
    color: var(--color-text-muted) !important;
  }

  .coordinates-display {
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
    padding: 0.5rem;
    background: #f3f4f6;
    border-radius: 8px;
  }

  .form-error {
    color: #dc2626;
    font-size: 0.875rem;
    text-align: center;
    padding: 0.75rem;
    background: #fef2f2;
    border-radius: 8px;
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
  }

  .cancel-button {
    flex: 1;
    background: white;
    color: #6b7280;
    border: 1px solid #d1d5db;
    padding: 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .cancel-button:hover:not(:disabled) {
    background: #f9fafb;
  }

  .cancel-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .submit-button {
    flex: 1;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition:
      transform 0.2s,
      box-shadow 0.2s,
      opacity 0.2s;
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .retry-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }

  .app-footer {
    background: white;
    padding: 1rem;
    text-align: center;
    border-top: 1px solid #e5e7eb;
  }

  .app-footer p {
    color: #9ca3af;
    font-size: 0.875rem;
    margin: 0;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .app-header {
      padding: 0.75rem;
      gap: 0.5rem;
    }

    .back-button {
      font-size: 0.875rem;
      padding: 0.375rem;
    }

    .app-title {
      font-size: 1.1rem;
    }

    .main-content {
      padding: 0.75rem;
    }

    .profile-form {
      gap: 1.25rem;
    }

    .phone-input-container {
      flex-direction: column;
    }

    .country-select {
      width: 100%;
    }

    .button-group {
      flex-direction: column;
    }
  }
</style>
