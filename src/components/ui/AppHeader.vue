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
  const currentUser = ref<{
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null>(null);
  const userIsAdmin = ref(false);

  // Get user initials for avatar
  const userInitials = computed(() => {
    const name = props.userName || currentUser.value?.first_name || "U";
    return name.charAt(0).toUpperCase();
  });

  // Build menu items based on user role
  const menuItems = computed(() => {
    const items = [];

    // User info header
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

    // Main navigation
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

    // Admin section
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

  // Check admin status on mount
  onMounted(async () => {
    if (authService.isAuthenticated()) {
      try {
        const response = await authService.me();
        currentUser.value = response.data;
        userIsAdmin.value = isAdmin(response.data);
      } catch {
        // Silent fail - user might not be logged in
      }
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
        @click="goBack"
      />
      <div
        v-if="showLogo"
        class="logo-container"
        @click="router.push('/profile')"
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
      <div class="user-menu-trigger" @click="toggleMenu">
        <Avatar
          :label="userInitials"
          shape="circle"
          class="user-avatar"
          :class="{ 'is-admin': props.isAdmin || userIsAdmin }"
        />
        <i class="pi pi-chevron-down menu-chevron"></i>
      </div>
      <Menu ref="menu" :model="menuItems" popup class="user-menu" />
    </div>
  </header>
</template>

<style scoped>
  .app-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.9) 100%
    );
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .back-button {
    color: var(--p-surface-600);
    transition: all 0.2s ease;
  }

  .back-button:hover {
    color: var(--p-primary-600);
    background: var(--p-primary-50);
  }

  .logo-container {
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .logo-container:hover {
    transform: scale(1.02);
  }

  .header-logo-img {
    height: 36px;
    width: auto;
    object-fit: contain;
    transition: transform 0.2s ease;
  }

  .logo-container:hover .header-logo-img {
    transform: scale(1.05);
  }

  .page-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--p-surface-800);
    margin: 0;
    padding-left: 0.75rem;
    border-left: 2px solid var(--p-surface-200);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-menu-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    border-radius: 2rem;
    transition: all 0.2s ease;
    background: var(--p-surface-100);
  }

  .user-menu-trigger:hover {
    background: var(--p-surface-200);
  }

  .user-avatar {
    width: 2rem;
    height: 2rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
    color: white !important;
    font-weight: 600;
    font-size: 0.875rem;
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .user-avatar.is-admin {
    background: linear-gradient(135deg, #f59e0b, #f97316) !important;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }

  .menu-chevron {
    font-size: 0.75rem;
    color: var(--p-surface-500);
  }

  :deep(.user-menu) {
    min-width: 220px;
    margin-top: 0.5rem;
  }

  :deep(.user-menu .p-menuitem-link) {
    padding: 0.75rem 1rem;
  }

  :deep(.admin-menu-item .p-menuitem-icon) {
    color: var(--p-warning-500);
  }

  :deep(.logout-menu-item .p-menuitem-icon) {
    color: var(--p-danger-500);
  }

  :deep(.logout-menu-item:hover .p-menuitem-icon) {
    color: var(--p-danger-600);
  }

  @media (max-width: 640px) {
    .app-header {
      padding: 0.625rem 1rem;
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
  /* Global styles for menu header */
  .user-menu-header {
    padding: 0.75rem 1rem;
    background: linear-gradient(
      135deg,
      var(--p-primary-50),
      var(--p-surface-50)
    );
  }

  .user-menu-header .user-name {
    font-weight: 600;
    color: var(--p-surface-800);
    font-size: 0.9375rem;
  }

  .user-menu-header .user-email {
    font-size: 0.8125rem;
    color: var(--p-surface-500);
    margin-top: 0.25rem;
  }

  .p-menu .p-menu-separator {
    margin: 0.5rem 0;
  }
</style>
