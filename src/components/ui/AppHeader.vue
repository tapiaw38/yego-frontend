<script setup lang="ts">
import Button from "primevue/button";
import Menu from "primevue/menu";
import Avatar from "primevue/avatar";
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { authService } from "@/api/authService";
import { isAdmin } from "@/types/auth";
import yegoLogo from "@/assets/img/yego-logo.png";
import NotificationBell from "./NotificationBell.vue";
import ChangePasswordModal from "@/components/ChangePasswordModal.vue";
import SetPasswordModal from "@/components/SetPasswordModal.vue";

interface Props {
  title?: string;
  showBack?: boolean;
  showLogo?: boolean;
  userName?: string;
  userEmail?: string;
  isAdmin?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  showBack: false,
  showLogo: true,
  userName: "",
  userEmail: "",
  isAdmin: false,
});

const emit = defineEmits<{
  back: [];
  logout: [];
}>();

const router = useRouter();
const menu = ref<InstanceType<typeof Menu>>();
const showChangePassword = ref(false);
const showSetPassword = ref(false);
const currentUser = ref<{
  first_name?: string;
  last_name?: string;
  email?: string;
  auth_method?: string;
} | null>(null);
const userIsAdmin = ref(false);

const userInitials = computed(() => {
  const name = props.userName || currentUser.value?.first_name || "U";
  return name.charAt(0).toUpperCase();
});

const menuItems = computed(() => {
  const items = [];

  items.push({
    template: () => ({
      template: `
      <div class="user-menu-header">
        <div class="user-name">${props.userName || currentUser.value?.first_name || "Usuario"}</div>
        <div class="user-email">${props.userEmail || currentUser.value?.email || ""}</div>
      </div>
    `,
    }),
  });

  items.push({ separator: true });

  items.push({
    label: "Mi Perfil",
    icon: "pi pi-user",
    command: () => router.push("/profile"),
  });

  items.push({
    label: "Mis Pedidos",
    icon: "pi pi-box",
    command: () => router.push("/my-orders"),
  });

  items.push({
    label: "Métodos de Pago",
    icon: "pi pi-credit-card",
    command: () => router.push("/payment-methods"),
  });

  const isGoogleUser = currentUser.value?.auth_method === 'google';
  items.push({
    label: isGoogleUser ? "Establecer Contraseña" : "Cambiar Contraseña",
    icon: "pi pi-lock",
    command: () => {
      if (isGoogleUser) {
        showSetPassword.value = true;
      } else {
        showChangePassword.value = true;
      }
    },
  });

  if (props.isAdmin || userIsAdmin.value) {
    items.push({ separator: true });
    items.push({
      label: "Panel Admin",
      icon: "pi pi-cog",
      class: "admin-menu-item",
      command: () => router.push("/admin"),
    });
  }

  items.push({ separator: true });

  items.push({
    label: "Cerrar Sesión",
    icon: "pi pi-sign-out",
    class: "logout-menu-item",
    command: handleLogout,
  });

  return items;
});

const toggleMenu = (event: Event) => {
  menu.value?.toggle(event);
};

const goBack = () => {
  if (props.showBack) {
    emit("back");
  } else {
    router.back();
  }
};

const handleLogout = () => {
  authService.logout();
  emit("logout");
  router.push("/login");
};

const refreshCurrentUser = async () => {
  try {
    const response = await authService.me();
    currentUser.value = response.data;
    userIsAdmin.value = isAdmin(response.data);
  } catch {
    // Silent fail
  }
};

onMounted(async () => {
  if (authService.isAuthenticated()) {
    await refreshCurrentUser();
  }
});
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <Button
        v-if="showBack"
        icon="pi pi-arrow-left"
        text
        rounded
        class="back-button"
        aria-label="Volver"
        @click="goBack"
      />
      <div
        v-if="showLogo"
        class="logo-container"
        role="link"
        tabindex="0"
        aria-label="Ir al inicio"
        @click="router.push('/profile')"
        @keydown.enter="router.push('/profile')"
      >
        <slot name="logo">
          <img :src="yegoLogo" alt="Yego" class="header-logo-img" />
        </slot>
      </div>
      <h1 v-if="title" class="page-title">{{ title }}</h1>
    </div>

    <div class="header-right">
      <slot name="actions" />
      <NotificationBell v-if="props.isAdmin || userIsAdmin" />
      <div
        class="user-menu-trigger"
        role="button"
        tabindex="0"
        aria-label="Menú de usuario"
        @click="toggleMenu"
        @keydown.enter="toggleMenu"
      >
        <Avatar
          :label="userInitials"
          shape="circle"
          class="user-avatar"
          :class="{ 'is-admin': props.isAdmin || userIsAdmin }"
        />
        <i class="pi pi-chevron-down menu-chevron" aria-hidden="true"></i>
      </div>
      <Menu ref="menu" :model="menuItems" popup class="user-menu" />
    </div>
  </header>

  <ChangePasswordModal v-model:visible="showChangePassword" />
  <SetPasswordModal v-model:visible="showSetPassword" @success="refreshCurrentUser" />
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: color-mix(in srgb, var(--bg-white) 95%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-light);
  box-shadow: 0 1px 3px var(--shadow-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.back-button {
  color: var(--color-text-secondary) !important;
  transition: all var(--transition-fast);
}

.back-button:hover {
  color: var(--color-primary) !important;
  background: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;
}

.logo-container {
  cursor: pointer;
  transition: transform var(--transition-fast);
  outline: none;
}

.logo-container:hover,
.logo-container:focus-visible {
  transform: scale(1.02);
}

.logo-container:focus-visible {
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--border-focus);
}

.header-logo-img {
  height: 36px;
  width: auto;
  object-fit: contain;
  display: block;
}

.page-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  padding-left: var(--spacing-sm);
  border-left: 2px solid var(--border-light);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  padding: 0.25rem var(--spacing-xs) 0.25rem 0.25rem;
  border-radius: var(--radius-xl);
  transition: background var(--transition-fast);
  background: var(--surface-ground);
  outline: none;
}

.user-menu-trigger:hover,
.user-menu-trigger:focus-visible {
  background: var(--vt-c-gray-200);
}

.user-menu-trigger:focus-visible {
  box-shadow: 0 0 0 2px var(--border-focus);
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  background: var(--gradient-primary) !important;
  color: var(--color-text-white) !important;
  font-weight: 600;
  font-size: 0.875rem;
  border: 2px solid var(--bg-white);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.user-avatar.is-admin {
  background: var(--gradient-warning) !important;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.menu-chevron {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

:deep(.user-menu) {
  min-width: 220px;
  margin-top: var(--spacing-xs);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 40px var(--shadow-medium);
  border: 1px solid var(--border-light);
}

:deep(.user-menu .p-menuitem-link) {
  padding: var(--spacing-sm) var(--spacing-md);
}

:deep(.admin-menu-item .p-menuitem-icon) {
  color: var(--color-warning);
}

:deep(.logout-menu-item .p-menuitem-icon) {
  color: var(--color-danger);
}

:deep(.logout-menu-item:hover .p-menuitem-icon) {
  color: var(--color-danger-dark);
}

@media (max-width: 640px) {
  .app-header {
    padding: 0.625rem var(--spacing-md);
  }

  .page-title {
    font-size: 1rem;
  }

  .header-logo-img {
    height: 28px;
  }

  .user-avatar {
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.8125rem;
  }

  .menu-chevron {
    display: none;
  }

  .user-menu-trigger {
    padding: 0.125rem;
  }
}
</style>

<style>
.user-menu-header {
  padding: var(--spacing-sm) var(--spacing-md);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary) 6%, white),
    var(--surface-ground)
  );
}

.user-menu-header .user-name {
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: 0.9375rem;
}

.user-menu-header .user-email {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.p-menu .p-menu-separator {
  margin: 0.5rem 0;
}
</style>
