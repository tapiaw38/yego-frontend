<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { profileService } from "../api/profileService";
  import { authService } from "../api/authService";
  import { settingsService } from "../api/settingsService";
  import type { Profile } from "../types/profile";
  import type { Settings } from "../types/settings";
  import { isAdmin } from "../types/auth";
  import MapboxPicker from "../components/MapboxPicker.vue";
  import { AppHeader } from "@/components/ui";

  const route = useRoute();
  const router = useRouter();
  const isUserAdmin = ref(false);
  const currentUser = ref<{
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null>(null);

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

  const loading = ref(true);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);
  const profile = ref<Profile | null>(null);
  const profileId = ref<string | null>(null);
  const isCompleted = ref(false);
  const settings = ref<Settings | null>(null);

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

  // Map default center and zoom from admin settings
  const mapDefaultCenter = computed(() => {
    if (settings.value) {
      return {
        lng: settings.value.default_map_longitude,
        lat: settings.value.default_map_latitude,
      };
    }
    return { lng: -58.3816, lat: -34.6037 };
  });

  const mapDefaultZoom = computed(() => {
    return settings.value?.default_map_zoom ?? 13;
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
    phoneNumber.value = fullPhone;
  };

  const loadProfile = async () => {
    try {
      loading.value = true;
      error.value = null;

      // First check if profile is completed
      const checkResult = await profileService.checkCompleted();
      isCompleted.value = checkResult.is_completed;
      profileId.value = checkResult.profile_id || null;

      if (!checkResult.profile_id) {
        // No profile exists - allow user to create one
        profile.value = null;
        error.value = null;
        loading.value = false;
        return;
      }

      // Load full profile
      try {
        profile.value = await profileService.getProfile(checkResult.profile_id);

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

        loading.value = false;
      } catch (profileErr: unknown) {
        // Profile exists but failed to load details
        const axiosError = profileErr as {
          response?: { data?: { message?: string } };
        };
        error.value =
          axiosError.response?.data?.message ||
          "Error al cargar los detalles del perfil";
        // Keep profileId so user can still try to update
        loading.value = false;
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message || "No se pudo verificar el perfil";
      profile.value = null;
      profileId.value = null;
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
      let updatedProfile: Profile;

      if (profileId.value) {
        updatedProfile = await profileService.updateProfile(profileId.value, {
          phone_number: fullPhoneNumber.value,
          longitude: location.value.lng,
          latitude: location.value.lat,
          address: address.value,
        });
      } else {
        updatedProfile = await profileService.upsertProfile({
          phone_number: fullPhoneNumber.value,
          longitude: location.value.lng,
          latitude: location.value.lat,
          address: address.value,
        });
        profileId.value = updatedProfile.id;
      }

      profile.value = updatedProfile;
      isCompleted.value = true;

      if (updatedProfile.phone_number) {
        parsePhoneNumber(updatedProfile.phone_number);
      }

      if (updatedProfile.location) {
        location.value = {
          lng: updatedProfile.location.longitude,
          lat: updatedProfile.location.latitude,
        };
        address.value = updatedProfile.location.address;
      }

      success.value = true;
      error.value = null;

      setTimeout(() => {
        const returnTo = route.query.returnTo as string;
        if (returnTo) {
          router.push(returnTo);
        } else {
          success.value = false;
        }
      }, 2000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      error.value =
        axiosError.response?.data?.message || "Error al guardar el perfil";
    } finally {
      submitting.value = false;
    }
  };

  const handleLogout = () => {
    authService.logout();
    router.push("/login");
  };

  const checkAdminStatus = async () => {
    if (!authService.isAuthenticated()) {
      isUserAdmin.value = false;
      return;
    }
    try {
      const response = await authService.me();
      isUserAdmin.value = isAdmin(response.data);
    } catch {
      isUserAdmin.value = false;
    }
  };

  const fetchCurrentUser = async () => {
    if (authService.isAuthenticated()) {
      try {
        const response = await authService.me();
        currentUser.value = response.data;
      } catch {
        // Silent fail
      }
    }
  };

  const loadSettings = async () => {
    try {
      settings.value = await settingsService.getSettings();
    } catch (err) {
      console.error("Error loading settings:", err);
      // Use default settings if loading fails
      settings.value = null;
    }
  };

  onMounted(async () => {
    try {
      // Load profile first as it's the most important
      await loadProfile();

      // Load other data in parallel (non-blocking)
      Promise.all([
        loadSettings(),
        checkAdminStatus(),
        fetchCurrentUser(),
      ]).catch((err) => {
        console.error("Error loading additional data:", err);
      });
    } catch (err) {
      console.error("Error in onMounted:", err);
      loading.value = false;
    }
  });
</script>

<template>
  <div class="profile-view">
    <AppHeader
      title="Mi Perfil"
      :is-admin="isUserAdmin"
      :user-name="currentUser?.first_name"
      :user-email="currentUser?.email"
      @logout="handleLogout"
    />

    <main class="main-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando perfil...</p>
      </div>

      <!-- Success State -->
      <div v-else-if="success" class="success-state">
        <div class="success-icon"><i class="pi pi-check-circle"></i></div>
        <h2>Perfil actualizado</h2>
        <p>Tu informacion ha sido guardada correctamente.</p>
      </div>

      <!-- Error loading profile details (but profile exists) -->
      <div v-else-if="error && profileId && !profile" class="form-container">
        <div class="profile-status status-incomplete">
          <span
            ><i class="pi pi-exclamation-triangle"></i> Error al cargar el
            perfil</span
          >
        </div>
        <div class="form-error">
          {{ error }}
        </div>
        <button @click="loadProfile()" class="submit-button">Reintentar</button>
      </div>

      <!-- Profile Form -->
      <div v-else class="form-container">
        <div
          v-if="profileId"
          class="profile-status"
          :class="{
            'status-complete': isCompleted,
            'status-incomplete': !isCompleted,
          }"
        >
          <span v-if="isCompleted"
            ><i class="pi pi-check-circle"></i> Perfil completo</span
          >
          <span v-else
            ><i class="pi pi-exclamation-triangle"></i> Perfil incompleto</span
          >
        </div>

        <div v-else class="profile-status status-incomplete">
          <span><i class="pi pi-info-circle"></i> Crea tu perfil</span>
        </div>

        <p class="form-intro">
          <span v-if="profileId">Actualiza tu informacion de entrega</span>
          <span v-else>Completa tu informacion de entrega</span>
        </p>

        <form @submit.prevent="handleSubmit" class="profile-form">
          <!-- Phone Number with Country Selector -->
          <div class="form-group">
            <label for="phone">Numero de telefono</label>
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
            <label>Ubicacion de entrega</label>
            <MapboxPicker
              v-model="location"
              :access-token="MAPBOX_TOKEN"
              :default-center="mapDefaultCenter"
              :default-zoom="mapDefaultZoom"
              @address-change="handleAddressChange"
            />
          </div>

          <!-- Address (auto-filled from map) -->
          <div class="form-group">
            <label for="address">Direccion</label>
            <input
              id="address"
              v-model="address"
              type="text"
              placeholder="Se completara automaticamente al seleccionar en el mapa"
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

          <!-- Submit button -->
          <button
            type="submit"
            class="submit-button"
            :disabled="submitting || !location || !phoneNumber"
          >
            <span v-if="submitting">Guardando...</span>
            <span v-else>Guardar cambios</span>
          </button>
        </form>
      </div>
    </main>

    <footer class="app-footer">
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

  .profile-status {
    text-align: center;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .status-complete {
    background: #d1fae5;
    color: #065f46;
  }

  .status-incomplete {
    background: #fef3c7;
    color: #92400e;
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

  .submit-button {
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
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .app-title {
      font-size: 1.1rem;
    }

    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .orders-button,
    .admin-button {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
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
  }
</style>
