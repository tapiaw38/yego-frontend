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

    <main class="profile-main">
      <!-- Loading State -->
      <div v-if="loading" class="feedback-state">
        <div class="spinner"></div>
        <p class="text-gray-500">Cargando perfil...</p>
      </div>

      <!-- Success State -->
      <div v-else-if="success" class="feedback-state card-modern feedback-card">
        <div class="feedback-icon text-success">
          <i class="pi pi-check-circle"></i>
        </div>
        <h2 class="text-gray-800">Perfil actualizado</h2>
        <p class="text-gray-500">Tu informacion ha sido guardada correctamente.</p>
      </div>

      <!-- Error loading profile details (but profile exists) -->
      <div v-else-if="error && profileId && !profile" class="card-modern form-card">
        <div class="profile-badge badge-warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>Error al cargar el perfil</span>
        </div>
        <div class="alert-danger">{{ error }}</div>
        <button @click="loadProfile()" class="btn-primary action-btn">
          Reintentar
        </button>
      </div>

      <!-- Profile Form -->
      <div v-else class="card-modern form-card">
        <!-- Status badge -->
        <div
          v-if="profileId"
          class="profile-badge"
          :class="isCompleted ? 'badge-success' : 'badge-warning'"
        >
          <i :class="isCompleted ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'"></i>
          <span>{{ isCompleted ? 'Perfil completo' : 'Perfil incompleto' }}</span>
        </div>
        <div v-else class="profile-badge badge-info">
          <i class="pi pi-info-circle"></i>
          <span>Crea tu perfil</span>
        </div>

        <p class="form-intro text-gray-500">
          <span v-if="profileId">Actualiza tu informacion de entrega</span>
          <span v-else>Completa tu informacion de entrega</span>
        </p>

        <form @submit.prevent="handleSubmit" class="profile-form">
          <!-- Phone Number with Country Selector -->
          <div class="form-group">
            <label class="form-label" for="phone">Numero de telefono</label>
            <div class="phone-input-row">
              <select v-model="selectedCountry" class="country-select input-modern">
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
                class="input-modern phone-input"
              />
            </div>
            <span v-if="phoneNumber" class="phone-preview text-primary">
              {{ fullPhoneNumber }}
            </span>
          </div>

          <!-- Location Map -->
          <div class="form-group">
            <label class="form-label">Ubicacion de entrega</label>
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
            <label class="form-label" for="address">Direccion</label>
            <input
              id="address"
              v-model="address"
              type="text"
              placeholder="Se completara automaticamente al seleccionar en el mapa"
              class="input-modern input-readonly"
              readonly
            />
          </div>

          <!-- Coordinates display -->
          <div v-if="location" class="coordinates-chip">
            <i class="pi pi-map-marker text-primary"></i>
            <span class="text-gray-500">
              {{ location.lat.toFixed(6) }}, {{ location.lng.toFixed(6) }}
            </span>
          </div>

          <!-- Error message -->
          <div v-if="error" class="alert-danger">{{ error }}</div>

          <!-- Submit button -->
          <button
            type="submit"
            class="btn-primary action-btn"
            :disabled="submitting || !location || !phoneNumber"
          >
            <i v-if="submitting" class="pi pi-spin pi-spinner"></i>
            <span>{{ submitting ? 'Guardando...' : 'Guardar cambios' }}</span>
          </button>
        </form>
      </div>
    </main>

    <footer class="app-footer">
      <p class="text-gray-400">Powered by Gillie AI</p>
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

  .profile-main {
    flex: 1;
    padding: var(--spacing-lg) var(--spacing-md);
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
  }

  /* Feedback states (loading / success) */
  .feedback-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-md);
    text-align: center;
    gap: var(--spacing-sm);
  }

  .feedback-card {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-2xl) var(--spacing-xl);
  }

  .feedback-icon {
    font-size: 3.5rem;
    line-height: 1;
  }

  /* Spinner */
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Form card */
  .form-card {
    padding: var(--spacing-xl);
    animation: fadeUp var(--transition-normal) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Status badges */
  .profile-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-xl);
    font-size: 0.8125rem;
    font-weight: var(--font-semibold);
    margin-bottom: var(--spacing-sm);
  }

  .badge-success {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success-dark);
  }

  .badge-warning {
    background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    color: var(--color-warning-dark);
  }

  .badge-info {
    background: color-mix(in srgb, var(--color-info) 12%, transparent);
    color: var(--color-info-dark);
  }

  /* Form layout */
  .form-intro {
    font-size: 0.9375rem;
    margin-bottom: var(--spacing-lg);
  }

  .profile-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
  }

  /* Phone row */
  .phone-input-row {
    display: flex;
    gap: var(--spacing-xs);
  }

  .country-select {
    min-width: 116px;
    cursor: pointer;
    background: var(--bg-white);
    color: var(--color-text-primary);
  }

  .phone-input {
    flex: 1;
    width: 100%;
  }

  .phone-preview {
    font-size: 0.75rem;
    font-weight: var(--font-semibold);
  }

  /* Readonly input */
  .input-readonly {
    background: var(--bg-lighter) !important;
    color: var(--color-text-muted) !important;
    cursor: default;
  }

  /* Coordinates chip */
  .coordinates-chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: 0.75rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-lighter);
    border-radius: var(--radius-xl);
    width: fit-content;
    margin: 0 auto;
  }

  /* Alert */
  .alert-danger {
    font-size: 0.875rem;
    color: var(--color-danger-dark);
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
    border-radius: var(--radius-md);
    text-align: center;
  }

  /* Action button */
  .action-btn {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .action-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  /* Footer */
  .app-footer {
    background: var(--surface-card);
    padding: var(--spacing-md);
    text-align: center;
    border-top: 1px solid var(--border-light);
  }

  .app-footer p {
    font-size: 0.8125rem;
    margin: 0;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .profile-main {
      padding: var(--spacing-md) var(--spacing-sm);
    }

    .form-card {
      padding: var(--spacing-lg) var(--spacing-md);
    }

    .phone-input-row {
      flex-direction: column;
    }

    .country-select {
      width: 100%;
    }
  }
</style>
