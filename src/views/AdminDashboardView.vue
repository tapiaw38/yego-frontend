<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from "vue";
  import { useRouter } from "vue-router";
  import { useToast } from "primevue/usetoast";
  import { apiClient } from "../api/client";
  import { authClient } from "../api/authClient";
  import { authService } from "../api/authService";
  import { paymentService } from "../api/paymentService";
  import { transactionService } from "../api/transactionService";
  import AdminSettingsPanel from "../components/AdminSettingsPanel.vue";
  import type { Transaction } from "../types/transaction";
  import {
    StatusLabels as TransactionStatusLabels,
    StatusColors as TransactionStatusColors,
  } from "../types/transaction";
  import { AppHeader } from "@/components/ui";
  import { importsService } from "../api/importsService";
  import type { ImportRecord } from "../types/import";
  import { useWebSocket } from "@/composables/useWebSocket";
  import {
    websocketService,
    type OrderClaimedPayload,
  } from "@/services/websocket/websocketService";
  import Toast from "primevue/toast";

  const router = useRouter();
  const toast = useToast();
  const currentUser = ref<{
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null>(null);

  interface Location {
    id: string;
    longitude: number;
    latitude: number;
    address: string;
  }

  interface Profile {
    id: string;
    user_id: string;
    phone_number: string;
    location: Location | null;
    created_at: string;
    updated_at: string;
  }

  interface Order {
    id: string;
    profile_id: string;
    user_id?: string;
    status: string;
    status_message?: string;
    status_index: number;
    eta: string;
    data?: {
      items: Array<{
        name: string;
        price: number;
        quantity: number;
        weight?: number;
      }>;
    };
    created_at: string;
    updated_at: string;
    all_statuses: string[];
  }

  interface UserInfo {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    has_payment_method?: boolean;
  }

  const profiles = ref<Profile[]>([]);
  const orders = ref<Order[]>([]);
  const transactions = ref<Transaction[]>([]);
  const usersMap = ref<Map<string, UserInfo>>(new Map());
  const loading = ref(true);
  const activeTab = ref<"orders" | "profiles" | "settings" | "transactions">(
    "orders",
  );
  const editingOrder = ref<Order | null>(null);
  const editForm = ref({ status: "", eta: "" });
  const saving = ref(false);
  const viewingProfile = ref<Profile | null>(null);
  const pausingOrder = ref<Order | null>(null);
  const pauseForm = ref({ reason: "", customMessage: "" });
  const viewingOrder = ref<Order | null>(null);
  const isEditingItems = ref(false);
  const savingItems = ref(false);
  const editableItems = ref<
    Array<{ name: string; price: number; quantity: number; weight?: number }>
  >([]);

  const pauseReasons = [
    { value: "phone", label: "Número de teléfono incorrecto" },
    { value: "address", label: "Dirección incompleta o incorrecta" },
    { value: "zone", label: "Fuera de zona de entrega" },
    { value: "no_response", label: "Cliente no responde" },
    { value: "other", label: "Otro" },
  ];

  const statusLabels: Record<string, string> = {
    CREATED: "Creado",
    CONFIRMED: "Confirmado",
    PREPARING: "En Preparación",
    ON_THE_WAY: "En Camino",
    DELIVERED: "Entregado",
    PAUSED: "Pausado",
    CANCELLED: "Cancelado",
    MODIFICATION_REQUESTED: "Modificación Solicitada",
  };

  const statusColors: Record<string, string> = {
    CREATED: "#6b7280",
    CONFIRMED: "#3b82f6",
    PREPARING: "#f59e0b",
    ON_THE_WAY: "#8b5cf6",
    DELIVERED: "#10b981",
    PAUSED: "#f59e0b",
    CANCELLED: "#ef4444",
    MODIFICATION_REQUESTED: "#f97316",
  };

  const fetchUserInfo = async (userId: string): Promise<UserInfo | null> => {
    try {
      const [userResponse, paymentResponse] = await Promise.all([
        authClient.get(`/user/${userId}`),
        paymentService.checkPaymentMethod(userId).catch((err) => {
          console.error(
            `Error checking payment method for user ${userId}:`,
            err,
          );
          return { has_payment_method: false };
        }),
      ]);
      const userInfo = userResponse.data.data;
      const result = {
        ...userInfo,
        has_payment_method: paymentResponse.has_payment_method,
      };
      console.log(`Fetched user info for ${userId}:`, {
        has_payment_method: result.has_payment_method,
      });
      return result;
    } catch (err) {
      console.error(`Error fetching user ${userId}:`, err);
      return null;
    }
  };

  const fetchData = async () => {
    loading.value = true;
    try {
      const [profilesRes, ordersRes, transactionsRes] = await Promise.all([
        apiClient.get("/api/admin/profiles"),
        apiClient.get("/api/admin/orders"),
        transactionService.getTransactions(),
      ]);
      profiles.value = profilesRes.data.profiles;
      orders.value = ordersRes.data.orders;
      transactions.value = transactionsRes.transactions;

      // Fetch user info for all unique user_ids from profiles and orders
      const profileUserIds = profiles.value
        .map((p) => p.user_id)
        .filter(Boolean);
      const orderUserIds = orders.value.map((o) => o.user_id).filter((id): id is string => Boolean(id));

      // Also get user_ids from order profiles
      const orderProfileUserIds = orders.value
        .map((o) => {
          const profile = profiles.value.find((p) => p.id === o.profile_id);
          return profile?.user_id;
        })
        .filter(Boolean);

      const uniqueUserIds = [
        ...new Set([
          ...profileUserIds,
          ...orderUserIds,
          ...orderProfileUserIds,
        ]),
      ].filter((id): id is string => Boolean(id));

      const userInfoPromises = uniqueUserIds.map(async (userId) => {
        const userInfo = await fetchUserInfo(userId);
        if (userInfo) {
          usersMap.value.set(userId, userInfo);
        }
      });
      await Promise.all(userInfoPromises);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      loading.value = false;
    }
  };

  const getUserInfo = (userId: string): UserInfo | undefined => {
    return usersMap.value.get(userId);
  };

  const getUserDisplayName = (userId: string): string => {
    const user = usersMap.value.get(userId);
    if (user) {
      return `${user.first_name} ${user.last_name}`;
    }
    return userId.slice(0, 12) + "...";
  };

  const getProfileForOrder = (profileId: string) => {
    return profiles.value.find((p) => p.id === profileId);
  };

  const openProfileDetail = (profile: Profile) => {
    viewingProfile.value = profile;
  };

  const closeProfileDetail = () => {
    viewingProfile.value = null;
  };

  const openOrderDetail = (order: Order) => {
    viewingOrder.value = order;
  };

  const closeOrderDetail = () => {
    viewingOrder.value = null;
    isEditingItems.value = false;
    editableItems.value = [];
  };

  // ── Autocomplete productos desde imports ─────────────────────────────────
  const importProducts = ref<ImportRecord[]>([]);
  const productsLoaded = ref(false);

  async function ensureProductsLoaded() {
    if (productsLoaded.value) return;
    try {
      const res = await importsService.getAll();
      importProducts.value = res.records ?? [];
      productsLoaded.value = true;
    } catch {
      // sin imports, el campo funciona manual
    }
  }

  function normalize(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function findImportValue(data: Record<string, unknown>, patterns: string[]): string | undefined {
    const key = Object.keys(data).find((k) =>
      patterns.some((p) => normalize(k).includes(normalize(p)))
    );
    return key ? String(data[key] ?? "") : undefined;
  }

  function getProductName(data: Record<string, unknown>): string {
    return (
      findImportValue(data, ["descripcion", "nombre", "name", "producto", "description"]) ??
      String(Object.values(data)[0] ?? "")
    );
  }

  function getProductPrice(data: Record<string, unknown>): number | undefined {
    const raw = findImportValue(data, ["precio", "price", "costo", "valor", "importe"]);
    if (raw === undefined) return undefined;
    const n = parseFloat(raw.replace(",", "."));
    return isNaN(n) ? undefined : Math.round(n * 100) / 100;
  }

  function getProductWeight(data: Record<string, unknown>): number | undefined {
    const raw = findImportValue(data, ["peso", "weight", "gramo", "gram"]);
    if (raw === undefined) return undefined;
    const n = parseFloat(raw.replace(",", "."));
    return isNaN(n) ? undefined : n;
  }

  function onNameInput(index: number) {
    const name = (editableItems.value[index]?.name ?? "").trim();
    if (!name) return;
    const matched = importProducts.value.find(
      (r) => normalize(getProductName(r.data)) === normalize(name)
    );
    if (!matched) return;
    const item = editableItems.value[index];
    if (!item) return;
    const price = getProductPrice(matched.data);
    if (price !== undefined) item.price = price;
    const weight = getProductWeight(matched.data);
    if (weight !== undefined) item.weight = weight;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const startEditingItems = () => {
    if (viewingOrder.value?.data?.items) {
      editableItems.value = viewingOrder.value.data.items.map((item) => ({
        ...item,
      }));
    } else {
      editableItems.value = [];
    }
    isEditingItems.value = true;
    ensureProductsLoaded();
  };

  const cancelEditingItems = () => {
    isEditingItems.value = false;
    editableItems.value = [];
  };

  const addEditableItem = () => {
    editableItems.value.push({ name: "", price: 0, quantity: 1 });
  };

  const removeEditableItem = (index: number) => {
    editableItems.value.splice(index, 1);
  };

  const editableItemsTotal = () => {
    return editableItems.value.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  };

  const saveItemsChanges = async () => {
    if (!viewingOrder.value || savingItems.value) return;

    const validItems = editableItems.value.filter(
      (item) => item.name.trim() !== "" && item.price >= 0 && item.quantity > 0,
    );

    if (validItems.length === 0) {
      alert("Debe haber al menos un producto valido");
      return;
    }

    savingItems.value = true;
    try {
      await apiClient.put(`/api/admin/orders/${viewingOrder.value.id}`, {
        data: { items: validItems },
      });
      // Update local order data
      if (viewingOrder.value) {
        viewingOrder.value.data = { items: validItems };
      }
      // Update orders list
      const orderIndex = orders.value.findIndex(
        (o) => o.id === viewingOrder.value?.id,
      );
      const orderToUpdate =
        orderIndex !== -1 ? orders.value[orderIndex] : undefined;
      if (orderToUpdate) {
        orderToUpdate.data = { items: validItems };
      }
      isEditingItems.value = false;
    } catch (err) {
      console.error("Error updating order items:", err);
      alert("Error al guardar los cambios");
    } finally {
      savingItems.value = false;
    }
  };

  const startEdit = async (order: Order) => {
    editingOrder.value = order;
    editForm.value = {
      status: order.status,
      eta: order.eta,
    };
  };

  const cancelEdit = () => {
    editingOrder.value = null;
    editForm.value = { status: "", eta: "" };
  };

  const startPause = (order: Order) => {
    pausingOrder.value = order;
    pauseForm.value = { reason: "", customMessage: "" };
  };

  const cancelPause = () => {
    pausingOrder.value = null;
    pauseForm.value = { reason: "", customMessage: "" };
  };

  const savePause = async () => {
    if (!pausingOrder.value || !pauseForm.value.reason) return;

    saving.value = true;
    try {
      let statusMessage = "";
      const reason = pauseReasons.find(
        (r) => r.value === pauseForm.value.reason,
      );

      if (pauseForm.value.reason === "other") {
        statusMessage = pauseForm.value.customMessage || "Pedido pausado";
      } else {
        statusMessage = reason?.label || "Pedido pausado";
        if (pauseForm.value.customMessage) {
          statusMessage += `: ${pauseForm.value.customMessage}`;
        }
      }

      const response = await apiClient.put(
        `/api/admin/orders/${pausingOrder.value.id}`,
        {
          status: "PAUSED",
          status_message: statusMessage,
        },
      );

      const index = orders.value.findIndex(
        (o) => o.id === pausingOrder.value?.id,
      );
      if (index !== -1) {
        orders.value[index] = response.data;
      }

      cancelPause();
    } catch (err) {
      console.error("Error pausing order:", err);
      alert("Error al pausar la orden");
    } finally {
      saving.value = false;
    }
  };

  const saveCancel = async () => {
    if (!pausingOrder.value || !pauseForm.value.reason) return;

    saving.value = true;
    try {
      let statusMessage = "";
      const reason = pauseReasons.find(
        (r) => r.value === pauseForm.value.reason,
      );

      if (pauseForm.value.reason === "other") {
        statusMessage = pauseForm.value.customMessage || "Pedido cancelado";
      } else {
        statusMessage = reason?.label || "Pedido cancelado";
        if (pauseForm.value.customMessage) {
          statusMessage += `: ${pauseForm.value.customMessage}`;
        }
      }

      const response = await apiClient.put(
        `/api/admin/orders/${pausingOrder.value.id}`,
        {
          status: "CANCELLED",
          status_message: statusMessage,
        },
      );

      const index = orders.value.findIndex(
        (o) => o.id === pausingOrder.value?.id,
      );
      if (index !== -1) {
        orders.value[index] = response.data;
      }

      cancelPause();
    } catch (err) {
      console.error("Error cancelling order:", err);
      alert("Error al cancelar la orden");
    } finally {
      saving.value = false;
    }
  };

  const saveOrder = async () => {
    if (!editingOrder.value) return;

    saving.value = true;
    try {
      const response = await apiClient.put(
        `/api/admin/orders/${editingOrder.value.id}`,
        {
          status: editForm.value.status,
          eta: editForm.value.eta,
        },
      );

      // Update local order
      const index = orders.value.findIndex(
        (o) => o.id === editingOrder.value?.id,
      );
      if (index !== -1) {
        orders.value[index] = response.data;
      }

      cancelEdit();
    } catch (err) {
      console.error("Error saving order:", err);
      alert("Error al guardar la orden");
    } finally {
      saving.value = false;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getOrderLink = (orderId: string) => {
    return `${window.location.origin}/order/${orderId}`;
  };

  const getGoogleMapsLink = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const calculateOrderTotal = (order: Order): number => {
    if (!order.data?.items) return 0;
    return order.data.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const shareOrderOnWhatsApp = (order: Order) => {
    const profile = getProfileForOrder(order.profile_id);
    if (!profile) return;

    const user = getUserInfo(profile.user_id);
    const userName = user ? `${user.first_name} ${user.last_name}` : "Cliente";
    const orderLink = getOrderLink(order.id);

    let message = `*Pedido para ${userName}*\n\n`;
    message += `*Estado:* ${statusLabels[order.status] || order.status}\n`;
    message += `*ETA:* ${order.eta}\n`;
    message += `*Teléfono:* ${profile.phone_number}\n`;

    if (profile.location) {
      const mapsLink = getGoogleMapsLink(
        profile.location.latitude,
        profile.location.longitude,
      );
      message += `*Dirección:* ${profile.location.address}\n`;
      message += `*Ubicación:* ${mapsLink}\n`;
    }

    message += `\n*Ver pedido:* ${orderLink}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  // WebSocket connection status
  const wsConnected = ref(false);

  // Setup WebSocket for real-time notifications
  const { isConnected } = useWebSocket({
    onOrderClaimed: (payload: OrderClaimedPayload) => {
      // Show toast notification
      toast.add({
        severity: "info",
        summary: "Nueva Orden Asignada",
        detail: `Un usuario ha reclamado la orden ${payload.order_id.slice(0, 8)}...`,
        life: 5000,
      });
      // Refresh orders list
      fetchData();
    },
    onConnected: () => {
      wsConnected.value = true;
      console.log("[AdminDashboard] WebSocket connected");
    },
    onDisconnected: () => {
      wsConnected.value = false;
      console.log("[AdminDashboard] WebSocket disconnected");
    },
  });

  const handleLogout = () => {
    websocketService.disconnect();
    authService.logout();
    router.push("/login");
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

  onMounted(() => {
    fetchData();
    fetchCurrentUser();

    // Connect WebSocket if authenticated
    const token = authService.getToken();
    if (token) {
      websocketService.connect(token);
    }
  });

  onUnmounted(() => {
    // Don't disconnect on unmount to allow notifications in other views
    // websocketService.disconnect()
  });
</script>

<template>
  <div class="admin-dashboard">
    <AppHeader
      title="Panel de Administración"
      :is-admin="true"
      :user-name="currentUser?.first_name || 'Admin'"
      :user-email="currentUser?.email"
      @logout="handleLogout"
    >
      <template #actions>
        <div class="header-actions-group">
          <div
            class="ws-status"
            :class="{ connected: isConnected }"
            :title="isConnected ? 'Conectado en tiempo real' : 'Desconectado'"
          >
            <span class="ws-indicator"></span>
            <span class="ws-text">{{
              isConnected ? "En vivo" : "Desconectado"
            }}</span>
          </div>
          <button @click="fetchData" class="refresh-btn" :disabled="loading">
            <i class="pi pi-refresh"></i>
            <span>{{ loading ? "Cargando..." : "Actualizar" }}</span>
          </button>
        </div>
      </template>
    </AppHeader>

    <nav class="tabs">
      <button
        :class="['tab', { active: activeTab === 'orders' }]"
        @click="activeTab = 'orders'"
      >
        Órdenes ({{ orders.length }})
      </button>
      <button
        :class="['tab', { active: activeTab === 'profiles' }]"
        @click="activeTab = 'profiles'"
      >
        Perfiles ({{ profiles.length }})
      </button>
      <button
        :class="['tab', { active: activeTab === 'settings' }]"
        @click="activeTab = 'settings'"
      >
        Configuración
      </button>
      <button
        :class="['tab', { active: activeTab === 'transactions' }]"
        @click="activeTab = 'transactions'"
      >
        Transacciones ({{ transactions.length }})
      </button>
      <button
        class="tab"
        @click="router.push('/admin/imports')"
      >
        Importaciones
      </button>
      <button
        class="tab"
        @click="router.push('/admin/images')"
      >
        Imágenes
      </button>
    </nav>

    <main class="dashboard-content">
      <!-- Loading -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Cargando datos...</p>
      </div>

      <!-- Orders Tab -->
      <div v-else-if="activeTab === 'orders'" class="orders-list">
        <div v-if="orders.length === 0" class="empty-state">
          <p>No hay órdenes registradas</p>
        </div>

        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Estado</th>
                <th>Pagado</th>
                <th>ETA</th>
                <th>Pedido</th>
                <th>Perfil</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in orders"
                :key="order.id"
                :class="{
                  'modification-requested-row':
                    order.status === 'MODIFICATION_REQUESTED',
                }"
              >
                <td class="id-cell">
                  <span class="id-text">{{ order.id.slice(0, 8) }}...</span>
                  <button
                    class="copy-btn"
                    @click="copyToClipboard(getOrderLink(order.id))"
                    title="Copiar link"
                  >
                    📋
                  </button>
                </td>
                <td>
                  <div class="status-cell">
                    <span
                      class="status-badge"
                      :style="{ backgroundColor: statusColors[order.status] }"
                    >
                      {{ statusLabels[order.status] || order.status }}
                    </span>
                    <span
                      v-if="
                        order.status === 'MODIFICATION_REQUESTED' &&
                        order.status_message
                      "
                      class="status-message-indicator"
                      :title="order.status_message"
                    >
                      💬
                    </span>
                  </div>
                  <p
                    v-if="
                      order.status === 'MODIFICATION_REQUESTED' &&
                      order.status_message
                    "
                    class="status-message-text"
                  >
                    {{ order.status_message }}
                  </p>
                </td>
                <td>
                  <span
                    v-if="order.status !== 'CREATED'"
                    class="paid-badge paid"
                  >
                    ✓ Pagado
                  </span>
                  <span v-else class="paid-badge unpaid"> ✗ Pendiente </span>
                </td>
                <td>{{ order.eta }}</td>
                <td>
                  <button
                    v-if="
                      order.data &&
                      order.data.items &&
                      order.data.items.length > 0
                    "
                    class="view-order-btn"
                    @click="openOrderDetail(order)"
                    title="Ver detalles del pedido"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      ></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>{{ order.data.items.length }} item(s)</span>
                  </button>
                  <span v-else class="no-items">Sin items</span>
                </td>
                <td>
                  <button
                    v-if="getProfileForOrder(order.profile_id)"
                    class="profile-link"
                    @click="
                      openProfileDetail(getProfileForOrder(order.profile_id)!)
                    "
                  >
                    <span class="profile-name">{{
                      getUserDisplayName(
                        getProfileForOrder(order.profile_id)!.user_id,
                      )
                    }}</span>
                    <span class="profile-phone">{{
                      getProfileForOrder(order.profile_id)?.phone_number
                    }}</span>
                  </button>
                  <span v-else class="profile-unknown">-</span>
                </td>
                <td>{{ formatDate(order.created_at) }}</td>
                <td class="actions-cell">
                  <button
                    class="edit-btn"
                    @click="startEdit(order)"
                    title="Editar orden"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                      ></path>
                      <path
                        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                      ></path>
                    </svg>
                  </button>
                  <button
                    v-if="
                      order.status !== 'CANCELLED' &&
                      order.status !== 'DELIVERED'
                    "
                    class="pause-cancel-btn"
                    @click="startPause(order)"
                    title="Pausar o Cancelar pedido"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </button>
                  <button
                    v-if="getProfileForOrder(order.profile_id)"
                    class="share-btn"
                    @click="shareOrderOnWhatsApp(order)"
                    title="Compartir por WhatsApp"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Settings Tab -->
      <div v-else-if="activeTab === 'settings'" class="settings-section">
        <AdminSettingsPanel />
      </div>

      <!-- Transactions Tab -->
      <div v-else-if="activeTab === 'transactions'" class="transactions-list">
        <div v-if="transactions.length === 0" class="empty-state">
          <p>No hay transacciones registradas</p>
        </div>

        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Orden</th>
                <th>Usuario</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Payment ID</th>
                <th>Collector ID</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in transactions" :key="transaction.id">
                <td class="id-cell">
                  <span class="id-text"
                    >{{ transaction.id.slice(0, 8) }}...</span
                  >
                </td>
                <td>
                  <span class="id-text"
                    >{{ transaction.order_id.slice(0, 8) }}...</span
                  >
                </td>
                <td>
                  <span class="id-text"
                    >{{ transaction.user_id.slice(0, 8) }}...</span
                  >
                </td>
                <td class="amount-cell">
                  <strong>{{ formatPrice(transaction.amount) }}</strong>
                </td>
                <td>
                  <span
                    class="status-badge"
                    :style="{
                      backgroundColor:
                        TransactionStatusColors[transaction.status] ||
                        '#6b7280',
                    }"
                  >
                    {{
                      TransactionStatusLabels[transaction.status] ||
                      transaction.status
                    }}
                  </span>
                </td>
                <td>
                  <span v-if="transaction.gateway_payment_id" class="id-text">
                    {{ transaction.gateway_payment_id }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span v-if="transaction.collector_id" class="id-text">
                    {{ transaction.collector_id }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  {{ new Date(transaction.created_at).toLocaleString("es-AR") }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Profiles Tab -->
      <div v-else-if="activeTab === 'profiles'" class="profiles-list">
        <div v-if="profiles.length === 0" class="empty-state">
          <p>No hay perfiles registrados</p>
        </div>

        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="profile in profiles" :key="profile.id">
                <td class="id-cell">
                  <span class="id-text">{{ profile.id.slice(0, 8) }}...</span>
                  <button
                    class="copy-btn"
                    @click="copyToClipboard(profile.id)"
                    title="Copiar ID"
                  >
                    📋
                  </button>
                </td>
                <td class="user-cell">
                  <div v-if="getUserInfo(profile.user_id)" class="user-info">
                    <span class="user-name">{{
                      getUserDisplayName(profile.user_id)
                    }}</span>
                    <span class="user-email">{{
                      getUserInfo(profile.user_id)?.email
                    }}</span>
                  </div>
                  <span v-else class="user-id-fallback"
                    >{{ profile.user_id.slice(0, 12) }}...</span
                  >
                </td>
                <td>{{ profile.phone_number }}</td>
                <td class="address-cell">
                  {{ profile.location?.address || "Sin dirección" }}
                </td>
                <td>{{ formatDate(profile.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Edit Order Modal -->
    <div v-if="editingOrder" class="modal-overlay" @click.self="cancelEdit">
      <div class="modal">
        <h2>Editar Orden</h2>
        <p class="modal-id">ID: {{ editingOrder.id }}</p>

        <div class="form-group">
          <label>Estado</label>
          <select v-model="editForm.status" class="form-select">
            <option
              v-for="status in editingOrder.all_statuses"
              :key="status"
              :value="status"
            >
              {{ statusLabels[status] || status }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Tiempo estimado (ETA)</label>
          <input
            v-model="editForm.eta"
            type="text"
            class="form-input"
            placeholder="ej: 30 minutos"
          />
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="cancelEdit" :disabled="saving">
            Cancelar
          </button>
          <button class="btn-save" @click="saveOrder" :disabled="saving">
            {{ saving ? "Guardando..." : "Guardar" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Pause/Cancel Order Modal -->
    <div v-if="pausingOrder" class="modal-overlay" @click.self="cancelPause">
      <div class="modal">
        <h2>Pausar o Cancelar Pedido</h2>
        <p class="modal-id">ID: {{ pausingOrder.id }}</p>

        <div class="form-group">
          <label>Razón</label>
          <select v-model="pauseForm.reason" class="form-select">
            <option value="">Seleccione una razón</option>
            <option
              v-for="reason in pauseReasons"
              :key="reason.value"
              :value="reason.value"
            >
              {{ reason.label }}
            </option>
          </select>
        </div>

        <div v-if="pauseForm.reason" class="form-group">
          <label>Mensaje adicional (opcional)</label>
          <textarea
            v-model="pauseForm.customMessage"
            class="form-textarea"
            placeholder="Agregar detalles adicionales..."
            rows="3"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="cancelPause" :disabled="saving">
            Cancelar
          </button>
          <button
            v-if="pausingOrder.status !== 'PAUSED'"
            class="btn-pause"
            @click="savePause"
            :disabled="saving || !pauseForm.reason"
          >
            {{ saving ? "Pausando..." : "Pausar" }}
          </button>
          <button
            class="btn-cancel-order"
            @click="saveCancel"
            :disabled="saving || !pauseForm.reason"
          >
            {{ saving ? "Cancelando..." : "Cancelar Pedido" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Profile Detail Modal -->
    <div
      v-if="viewingProfile"
      class="modal-overlay"
      @click.self="closeProfileDetail"
    >
      <div class="modal profile-modal">
        <h2>Detalle del Perfil</h2>

        <div class="profile-detail-section">
          <h3>Usuario</h3>
          <div
            v-if="getUserInfo(viewingProfile.user_id)"
            class="detail-content"
          >
            <div class="detail-row">
              <span class="detail-label">Nombre:</span>
              <span class="detail-value">{{
                getUserDisplayName(viewingProfile.user_id)
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">{{
                getUserInfo(viewingProfile.user_id)?.email
              }}</span>
            </div>
          </div>
          <div v-else class="detail-content">
            <div class="detail-row">
              <span class="detail-label">ID:</span>
              <span class="detail-value user-id-text">{{
                viewingProfile.user_id
              }}</span>
            </div>
          </div>
        </div>

        <div class="profile-detail-section">
          <h3>Contacto</h3>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">Teléfono:</span>
              <span class="detail-value">{{
                viewingProfile.phone_number
              }}</span>
            </div>
          </div>
        </div>

        <div class="profile-detail-section">
          <h3>Ubicación</h3>
          <div v-if="viewingProfile.location" class="detail-content">
            <div class="detail-row">
              <span class="detail-label">Dirección:</span>
              <span class="detail-value">{{
                viewingProfile.location.address
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Coordenadas:</span>
              <span class="detail-value">
                <a
                  :href="
                    getGoogleMapsLink(
                      viewingProfile.location.latitude,
                      viewingProfile.location.longitude,
                    )
                  "
                  target="_blank"
                  rel="noopener noreferrer"
                  class="maps-link"
                >
                  <i class="pi pi-map-marker"></i> Ver en Google Maps
                </a>
              </span>
            </div>
          </div>
          <div v-else class="detail-content">
            <span class="no-data">Sin ubicación registrada</span>
          </div>
        </div>

        <div class="profile-detail-section">
          <h3>Fechas</h3>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">Creado:</span>
              <span class="detail-value">{{
                formatDate(viewingProfile.created_at)
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Actualizado:</span>
              <span class="detail-value">{{
                formatDate(viewingProfile.updated_at)
              }}</span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeProfileDetail">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- Order Detail Modal -->
    <div
      v-if="viewingOrder"
      class="modal-overlay"
      @click.self="closeOrderDetail"
    >
      <div class="modal order-modal">
        <h2>
          {{
            isEditingItems ? "Editar Items del Pedido" : "Detalles del Pedido"
          }}
        </h2>
        <p class="modal-id">ID: {{ viewingOrder.id }}</p>

        <!-- View Mode -->
        <template v-if="!isEditingItems">
          <div
            v-if="
              viewingOrder.data &&
              viewingOrder.data.items &&
              viewingOrder.data.items.length > 0
            "
            class="order-items-section"
          >
            <h3>Items del Pedido</h3>
            <div class="items-list">
              <div
                v-for="(item, index) in viewingOrder.data.items"
                :key="index"
                class="item-row"
              >
                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-quantity"
                    >Cantidad: {{ item.quantity }}</span
                  >
                </div>
                <div class="item-price">
                  {{ formatPrice(item.price * item.quantity) }}
                </div>
              </div>
            </div>
            <div class="order-total">
              <span class="total-label">Total:</span>
              <span class="total-amount">{{
                formatPrice(calculateOrderTotal(viewingOrder))
              }}</span>
            </div>
          </div>
          <div v-else class="no-items-message">
            <p>Este pedido no tiene items registrados.</p>
          </div>

          <div class="modal-actions">
            <button class="btn-edit" @click="startEditingItems">
              Editar Items
            </button>
            <button class="btn-cancel" @click="closeOrderDetail">Cerrar</button>
          </div>
        </template>

        <!-- Edit Mode -->
        <template v-else>
          <div class="order-items-section edit-mode">
            <div class="editable-items-list">
              <div
                v-for="(item, index) in editableItems"
                :key="index"
                class="editable-item-row"
              >
                <div class="editable-item-fields">
                  <input
                    v-model="item.name"
                    type="text"
                    :list="`prod-list-${index}`"
                    placeholder="Nombre del producto"
                    class="item-input"
                    @input="onNameInput(index)"
                  />
                  <datalist :id="`prod-list-${index}`">
                    <option
                      v-for="r in importProducts"
                      :key="r.id"
                      :value="getProductName(r.data)"
                    />
                  </datalist>
                  <div class="item-number-fields">
                    <div class="field-group">
                      <label>Precio</label>
                      <input
                        v-model.number="item.price"
                        type="number"
                        min="0"
                        step="0.01"
                        class="item-input"
                      />
                    </div>
                    <div class="field-group">
                      <label>Cant.</label>
                      <input
                        v-model.number="item.quantity"
                        type="number"
                        min="1"
                        class="item-input"
                      />
                    </div>
                    <div class="field-group">
                      <label>Peso (g)</label>
                      <input
                        v-model.number="item.weight"
                        type="number"
                        min="0"
                        placeholder="Opcional"
                        class="item-input"
                      />
                    </div>
                  </div>
                </div>
                <button
                  class="btn-remove-item"
                  @click="removeEditableItem(index)"
                  title="Eliminar"
                >
                  <i class="pi pi-times"></i>
                </button>
              </div>

              <button class="btn-add-item" @click="addEditableItem">
                + Agregar producto
              </button>
            </div>

            <div class="order-total">
              <span class="total-label">Total:</span>
              <span class="total-amount">{{
                formatPrice(editableItemsTotal())
              }}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button
              class="btn-cancel"
              @click="cancelEditingItems"
              :disabled="savingItems"
            >
              Cancelar
            </button>
            <button
              class="btn-save"
              @click="saveItemsChanges"
              :disabled="savingItems"
            >
              {{ savingItems ? "Guardando..." : "Guardar" }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Toast notifications -->
    <Toast position="top-right" />
  </div>

</template>

<style scoped>
  .admin-dashboard {
    min-height: 100vh;
    background: var(--surface-ground);
  }

  /* Header action group */
  .header-actions-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  /* WebSocket status pill */
  .ws-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 0.375rem 0.75rem;
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-danger-dark);
    transition: all var(--transition-normal);
  }

  .ws-status.connected {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success-dark);
  }

  .ws-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-danger);
    animation: pulse 2s infinite;
    flex-shrink: 0;
  }

  .ws-status.connected .ws-indicator {
    background: var(--color-success);
    animation: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .ws-text {
    white-space: nowrap;
  }

  /* Refresh button */
  .refresh-btn {
    background: var(--bg-white);
    color: var(--color-primary);
    border: 1px solid var(--border-light);
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    border-radius: var(--radius-sm);
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--color-primary);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Tabs navigation */
  .tabs {
    display: flex;
    background: var(--bg-white);
    border-bottom: 1px solid var(--border-light);
    padding: 0 var(--spacing-xs);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    padding: 0.875rem 1rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-weight: 500;
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
    white-space: nowrap;
    font-size: 0.9375rem;
  }

  .tab:hover {
    color: var(--color-text-primary);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  /* Dashboard content area */
  .dashboard-content {
    padding: var(--spacing-md);
    max-width: 1400px;
    margin: 0 auto;
    color: var(--color-text-primary);
  }

  /* Loading state */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-2xl);
    color: var(--color-text-muted);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-muted);
  }

  /* Table */
  .table-container {
    background: var(--bg-white);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-light);
    overflow-x: auto;
    border: 1px solid var(--border-light);
    -webkit-overflow-scrolling: touch;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 900px;
  }

  .data-table th,
  .data-table td {
    padding: 0.875rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-light);
  }

  .data-table th {
    background: var(--bg-light);
    font-weight: 600;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .data-table td {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    vertical-align: middle;
  }

  .data-table tbody tr:hover {
    background: var(--surface-hover);
  }

  .data-table tbody tr:last-child td {
    border-bottom: none;
  }

  /* Table cell variants */
  .id-cell {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .id-text {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }

  .copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem;
    opacity: 0.5;
    transition: opacity var(--transition-fast);
    line-height: 1;
  }

  .copy-btn:hover {
    opacity: 1;
  }

  /* Status badges */
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    color: var(--color-text-white);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .status-cell {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .status-message-indicator {
    cursor: help;
    font-size: 0.875rem;
  }

  .status-message-text {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--color-danger-dark);
    font-style: italic;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Paid badge */
  .paid-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .paid-badge.paid {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success-dark);
  }

  .paid-badge.unpaid {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger-dark);
  }

  /* Profile / user cells */
  .profile-link {
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0.25rem var(--spacing-xs);
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .profile-link:hover {
    background: var(--surface-hover);
  }

  .profile-name {
    font-weight: 500;
    color: var(--color-primary-dark);
  }

  .profile-phone {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .profile-unknown {
    color: var(--color-text-muted);
  }

  .user-cell {
    min-width: 180px;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .user-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .user-email {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .user-id-fallback {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .address-cell {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-items {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .amount-cell {
    color: var(--color-success-dark);
    font-weight: 600;
  }

  .text-muted {
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Action buttons (icon only) */
  .actions-cell {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .edit-btn,
  .pause-cancel-btn,
  .share-btn,
  .view-order-btn {
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .edit-btn,
  .pause-cancel-btn,
  .share-btn {
    width: 32px;
    height: 32px;
    padding: 0;
  }

  .edit-btn {
    background: var(--color-primary);
    color: var(--color-text-white);
  }

  .edit-btn:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .pause-cancel-btn {
    background: var(--color-warning);
    color: var(--color-text-white);
  }

  .pause-cancel-btn:hover {
    background: var(--color-warning-dark);
    transform: translateY(-1px);
  }

  .share-btn {
    background: #25d366;
    color: var(--color-text-white);
  }

  .share-btn:hover {
    background: #1ebe5d;
    transform: translateY(-1px);
  }

  .view-order-btn {
    background: var(--color-primary);
    color: var(--color-text-white);
    padding: 0.4rem 0.625rem;
    gap: var(--spacing-xs);
    font-size: 0.8125rem;
  }

  .view-order-btn:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .edit-btn svg,
  .pause-cancel-btn svg,
  .share-btn svg,
  .view-order-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Modification requested row highlight */
  .modification-requested-row {
    background: color-mix(in srgb, var(--color-warning) 8%, transparent) !important;
    border-left: 3px solid var(--color-warning);
  }

  .modification-requested-row:hover {
    background: color-mix(in srgb, var(--color-warning) 14%, transparent) !important;
  }

  /* Settings section */
  .settings-section {
    max-width: 800px;
  }

  /* Modal overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-md);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    background: var(--bg-white);
    border-radius: var(--radius-lg);
    padding: var(--spacing-xl);
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-heavy);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .profile-modal {
    max-width: 500px;
  }

  .order-modal {
    max-width: 600px;
  }

  .modal h2 {
    margin: 0 0 var(--spacing-xs);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .modal-id {
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    margin-bottom: var(--spacing-lg);
    font-family: monospace;
  }

  /* Modal form elements */
  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .form-select,
  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.9375rem;
    background: var(--bg-white);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .form-select:focus,
  .form-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.9375rem;
    font-family: inherit;
    resize: vertical;
    color: var(--color-text-primary);
    background: var(--bg-white);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .form-textarea:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  /* Modal action buttons */
  .modal-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-lg);
    flex-wrap: wrap;
  }

  .btn-cancel,
  .btn-save,
  .btn-pause,
  .btn-cancel-order,
  .btn-edit {
    flex: 1;
    padding: 0.75rem var(--spacing-md);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: none;
    min-width: 100px;
  }

  .btn-cancel {
    background: var(--bg-white);
    border: 1px solid var(--border-default);
    color: var(--color-text-secondary);
  }

  .btn-cancel:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-default);
  }

  .btn-save {
    background: var(--gradient-primary);
    color: var(--color-text-white);
  }

  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-edit {
    background: var(--color-success);
    color: var(--color-text-white);
  }

  .btn-edit:hover {
    background: var(--color-success-dark);
  }

  .btn-pause {
    background: var(--color-warning);
    color: var(--color-text-white);
  }

  .btn-pause:hover:not(:disabled) {
    background: var(--color-warning-dark);
  }

  .btn-cancel-order {
    background: var(--color-danger);
    color: var(--color-text-white);
  }

  .btn-cancel-order:hover:not(:disabled) {
    background: var(--color-danger-dark);
  }

  .btn-cancel:disabled,
  .btn-save:disabled,
  .btn-pause:disabled,
  .btn-cancel-order:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  /* Profile detail sections */
  .profile-detail-section {
    margin-bottom: var(--spacing-md);
  }

  .profile-detail-section h3 {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted);
    margin: 0 0 var(--spacing-sm);
    padding-bottom: var(--spacing-xs);
    border-bottom: 1px solid var(--border-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-content {
    padding-left: var(--spacing-xs);
  }

  .detail-row {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    font-size: 0.875rem;
  }

  .detail-label {
    color: var(--color-text-muted);
    width: 100px;
    flex-shrink: 0;
  }

  .detail-value {
    color: var(--color-text-primary);
    word-break: break-word;
  }

  .detail-value.user-id-text {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .maps-link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    transition: color var(--transition-fast);
  }

  .maps-link:hover {
    color: var(--color-primary-dark);
    text-decoration: underline;
  }

  .no-data {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Order detail items */
  .order-items-section {
    margin-bottom: var(--spacing-lg);
  }

  .order-items-section h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--spacing-md);
    padding-bottom: var(--spacing-xs);
    border-bottom: 2px solid var(--border-light);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-light);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
  }

  .item-name {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .item-quantity {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .item-price {
    font-weight: 700;
    color: var(--color-primary);
    font-size: 1rem;
  }

  .order-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    background: var(--gradient-primary);
    color: var(--color-text-white);
    border-radius: var(--radius-sm);
    margin-top: var(--spacing-md);
  }

  .total-label {
    font-size: 1rem;
    font-weight: 600;
  }

  .total-amount {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .no-items-message {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .no-items-message p {
    margin: 0;
  }

  /* Editable items */
  .edit-mode {
    max-height: 400px;
    overflow-y: auto;
  }

  .editable-items-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .editable-item-row {
    display: flex;
    gap: var(--spacing-xs);
    align-items: flex-start;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-light);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
  }

  .editable-item-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .item-input {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    background: var(--bg-white);
    color: var(--color-text-primary);
    transition: border-color var(--transition-fast);
  }

  .item-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .item-number-fields {
    display: flex;
    gap: var(--spacing-xs);
  }

  .field-group {
    flex: 1;
  }

  .field-group label {
    display: block;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-bottom: 0.2rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .btn-remove-item {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background var(--transition-fast);
  }

  .btn-remove-item:hover {
    background: color-mix(in srgb, var(--color-danger) 22%, transparent);
  }

  .btn-add-item {
    background: var(--bg-light);
    color: var(--color-text-secondary);
    border: 2px dashed var(--border-default);
    padding: var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 100%;
  }

  .btn-add-item:hover {
    background: var(--surface-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .dashboard-content {
      padding: var(--spacing-sm);
    }

    .data-table th,
    .data-table td {
      padding: 0.75rem var(--spacing-sm);
    }

    .tab {
      padding: 0.75rem 0.875rem;
      font-size: 0.875rem;
    }

    .edit-btn,
    .pause-cancel-btn,
    .share-btn {
      width: 28px;
      height: 28px;
    }

    .edit-btn svg,
    .pause-cancel-btn svg,
    .share-btn svg {
      width: 14px;
      height: 14px;
    }
  }

  @media (max-width: 640px) {
    .ws-text {
      display: none;
    }

    .ws-status {
      padding: 0.375rem;
    }

    .refresh-btn span {
      display: none;
    }

    .refresh-btn {
      padding: 0.5rem;
    }

    .modal {
      padding: var(--spacing-md);
      max-height: 95vh;
    }

    .modal-overlay {
      padding: var(--spacing-xs);
    }

    .modal h2 {
      font-size: 1.1rem;
    }

    .modal-actions {
      flex-wrap: wrap;
    }
  }

</style>
