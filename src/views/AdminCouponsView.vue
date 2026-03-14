<script setup lang="ts">
  import { ref, onMounted, computed } from "vue"
  import { useRouter } from "vue-router"
  import { couponService } from "../api/couponService"
  import type { Coupon, CreateCouponInput, UpdateCouponInput } from "../types/coupon"

  const router = useRouter()

  const coupons = ref<Coupon[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const deleting = ref<string | null>(null)
  const error = ref<string | null>(null)

  // Modal states
  const showCreateModal = ref(false)
  const editingCoupon = ref<Coupon | null>(null)

  // Create form
  const emptyForm = (): CreateCouponInput => ({
    code: "",
    description: "",
    discount_type: "PERCENTAGE",
    discount_value: 10,
    max_uses: null,
    usage_limit_per_user: 1,
    min_order_amount: null,
    valid_from: null,
    valid_until: null,
    active: true,
    icon_url: null,
    cover_url: null,
  })

  const createForm = ref<CreateCouponInput>(emptyForm())
  const editForm = ref<UpdateCouponInput>({})

  // Search
  const searchQuery = ref("")

  const filteredCoupons = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return coupons.value
    return coupons.value.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    )
  })

  async function loadCoupons() {
    loading.value = true
    error.value = null
    try {
      coupons.value = await couponService.list()
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { message?: string } } }
      error.value = axiosErr.response?.data?.message ?? "No se pudieron cargar los cupones"
    } finally {
      loading.value = false
    }
  }

  onMounted(loadCoupons)

  function openCreate() {
    createForm.value = emptyForm()
    showCreateModal.value = true
  }

  function closeCreate() {
    showCreateModal.value = false
  }

  async function saveCreate() {
    if (!createForm.value.code.trim()) return
    saving.value = true
    error.value = null
    try {
      const payload: CreateCouponInput = {
        ...createForm.value,
        code: createForm.value.code.trim().toUpperCase(),
        max_uses: createForm.value.max_uses || null,
        min_order_amount: createForm.value.min_order_amount || null,
        valid_from: createForm.value.valid_from || null,
        valid_until: createForm.value.valid_until || null,
        icon_url: createForm.value.icon_url?.trim() || null,
        cover_url: createForm.value.cover_url?.trim() || null,
      }
      const created = await couponService.create(payload)
      coupons.value.unshift(created)
      closeCreate()
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { message?: string } } }
      error.value = axiosErr.response?.data?.message ?? "Error al crear el cupón"
    } finally {
      saving.value = false
    }
  }

  function openEdit(coupon: Coupon) {
    editingCoupon.value = coupon
    editForm.value = {
      code: coupon.code,
      description: coupon.description ?? "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      max_uses: coupon.max_uses ?? null,
      usage_limit_per_user: coupon.usage_limit_per_user,
      min_order_amount: coupon.min_order_amount ?? null,
      valid_from: coupon.valid_from ? toDateTimeLocal(coupon.valid_from) : "",
      valid_until: coupon.valid_until ? toDateTimeLocal(coupon.valid_until) : "",
      active: coupon.active,
      icon_url: coupon.icon_url ?? "",
      cover_url: coupon.cover_url ?? "",
    }
  }

  function closeEdit() {
    editingCoupon.value = null
  }

  async function saveEdit() {
    if (!editingCoupon.value) return
    saving.value = true
    error.value = null
    try {
      const payload: UpdateCouponInput = {
        ...editForm.value,
        code: (editForm.value.code ?? "").trim().toUpperCase(),
        max_uses: editForm.value.max_uses || null,
        min_order_amount: editForm.value.min_order_amount || null,
        valid_from: toRFC3339OrNull(editForm.value.valid_from as string),
        valid_until: toRFC3339OrNull(editForm.value.valid_until as string),
        icon_url: (editForm.value.icon_url as string)?.trim() || null,
        cover_url: (editForm.value.cover_url as string)?.trim() || null,
      }
      const updated = await couponService.update(editingCoupon.value.id, payload)
      const idx = coupons.value.findIndex((c) => c.id === updated.id)
      if (idx !== -1) coupons.value[idx] = updated
      closeEdit()
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { message?: string } } }
      error.value = axiosErr.response?.data?.message ?? "Error al actualizar el cupón"
    } finally {
      saving.value = false
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`¿Eliminar el cupón "${coupon.code}"?`)) return
    deleting.value = coupon.id
    try {
      await couponService.remove(coupon.id)
      coupons.value = coupons.value.filter((c) => c.id !== coupon.id)
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { message?: string } } }
      error.value = axiosErr.response?.data?.message ?? "Error al eliminar el cupón"
    } finally {
      deleting.value = null
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  function toDateTimeLocal(iso: string): string {
    if (!iso) return ""
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function toRFC3339OrNull(value: string): string | null {
    if (!value) return null
    return new Date(value).toISOString()
  }

  function discountLabel(coupon: Coupon) {
    if (coupon.discount_type === "PERCENTAGE") return `${coupon.discount_value}%`
    return `$${coupon.discount_value}`
  }
</script>

<template>
  <div class="coupons-view">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/admin')">← Volver</button>
      <h1>Cupones de descuento</h1>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <section class="section">
      <div class="section-header">
        <h2>
          Cupones
          <span v-if="!loading" class="records-total">({{ coupons.length }})</span>
        </h2>
        <div class="toolbar">
          <input
            v-model="searchQuery"
            class="search-input"
            placeholder="Buscar por código o descripción…"
          />
          <button class="btn btn-add btn-sm" @click="openCreate">+ Nuevo cupón</button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Cargando cupones…</p>
      </div>

      <div v-else-if="coupons.length === 0" class="empty-state">
        <p>No hay cupones todavía. Crea el primero.</p>
      </div>

      <div v-else-if="filteredCoupons.length === 0" class="empty-state">
        <p>Sin resultados para "<strong>{{ searchQuery }}</strong>".</p>
      </div>

      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Descuento</th>
              <th>Usos</th>
              <th>Límite/usuario</th>
              <th>Válido hasta</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="coupon in filteredCoupons" :key="coupon.id">
              <td>
                <div class="coupon-code-cell">
                  <img v-if="coupon.icon_url" :src="coupon.icon_url" class="coupon-icon" alt="" />
                  <span class="coupon-code">{{ coupon.code }}</span>
                </div>
              </td>
              <td class="text-muted">{{ coupon.description ?? "—" }}</td>
              <td>
                <span class="discount-badge" :class="coupon.discount_type === 'PERCENTAGE' ? 'badge-pct' : 'badge-fixed'">
                  {{ discountLabel(coupon) }}
                </span>
              </td>
              <td>
                {{ coupon.current_uses }}
                <span v-if="coupon.max_uses" class="text-muted">/ {{ coupon.max_uses }}</span>
                <span v-else class="text-muted">/ ∞</span>
              </td>
              <td>{{ coupon.usage_limit_per_user }} vez</td>
              <td class="text-muted">{{ coupon.valid_until ? formatDate(coupon.valid_until) : "—" }}</td>
              <td>
                <span class="status-dot" :class="coupon.active ? 'dot-active' : 'dot-inactive'">
                  {{ coupon.active ? "Activo" : "Inactivo" }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="btn btn-sm btn-secondary" @click="openEdit(coupon)">Editar</button>
                <button
                  class="btn btn-sm btn-danger"
                  :disabled="deleting === coupon.id"
                  @click="deleteCoupon(coupon)"
                >
                  {{ deleting === coupon.id ? "…" : "Eliminar" }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreate">
      <div class="modal modal-lg">
        <h3>Nuevo cupón</h3>

        <div class="form-grid">
          <div class="form-group">
            <label>Código <span class="required">*</span></label>
            <input
              v-model="createForm.code"
              class="form-input"
              placeholder="EJ: DESCUENTO10"
              style="text-transform: uppercase"
            />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <input v-model="createForm.description" class="form-input" placeholder="Descripción del cupón" />
          </div>

          <div class="form-group">
            <label>Tipo de descuento <span class="required">*</span></label>
            <select v-model="createForm.discount_type" class="form-input">
              <option value="PERCENTAGE">Porcentaje (%)</option>
              <option value="FIXED">Monto fijo ($)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Valor <span class="required">*</span></label>
            <input
              v-model.number="createForm.discount_value"
              type="number"
              min="0"
              class="form-input"
              :placeholder="createForm.discount_type === 'PERCENTAGE' ? 'Ej: 10 (= 10%)' : 'Ej: 500 (= $500)'"
            />
          </div>

          <div class="form-group">
            <label>Usos máximos totales</label>
            <input
              v-model.number="createForm.max_uses"
              type="number"
              min="1"
              class="form-input"
              placeholder="Dejar vacío = ilimitado"
            />
          </div>
          <div class="form-group">
            <label>Usos máximos por usuario <span class="required">*</span></label>
            <input
              v-model.number="createForm.usage_limit_per_user"
              type="number"
              min="1"
              class="form-input"
              placeholder="Ej: 1"
            />
          </div>

          <div class="form-group">
            <label>Monto mínimo de pedido</label>
            <input
              v-model.number="createForm.min_order_amount"
              type="number"
              min="0"
              class="form-input"
              placeholder="Dejar vacío = sin mínimo"
            />
          </div>
          <div class="form-group">
            <label>Estado</label>
            <label class="toggle-label">
              <input v-model="createForm.active" type="checkbox" class="toggle-input" />
              <span class="toggle-switch"></span>
              <span>{{ createForm.active ? "Activo" : "Inactivo" }}</span>
            </label>
          </div>

          <div class="form-group">
            <label>Válido desde</label>
            <input v-model="createForm.valid_from" type="datetime-local" class="form-input" />
          </div>
          <div class="form-group">
            <label>Válido hasta</label>
            <input v-model="createForm.valid_until" type="datetime-local" class="form-input" />
          </div>

          <div class="form-group form-group--full">
            <label>URL del ícono</label>
            <input v-model="createForm.icon_url" class="form-input" placeholder="https://…" />
          </div>
          <div class="form-group form-group--full">
            <label>URL de portada <span class="optional">(opcional)</span></label>
            <input v-model="createForm.cover_url" class="form-input" placeholder="https://… (puede dejarse vacío)" />
            <div v-if="createForm.cover_url" class="cover-preview">
              <img :src="createForm.cover_url" alt="Portada" />
            </div>
          </div>
        </div>

        <div v-if="error" class="modal-error">{{ error }}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeCreate">Cancelar</button>
          <button
            class="btn btn-primary"
            :disabled="saving || !createForm.code.trim()"
            @click="saveCreate"
          >
            {{ saving ? "Guardando…" : "Crear cupón" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingCoupon" class="modal-overlay" @click.self="closeEdit">
      <div class="modal modal-lg">
        <h3>Editar cupón</h3>

        <div class="form-grid">
          <div class="form-group">
            <label>Código <span class="required">*</span></label>
            <input
              v-model="editForm.code"
              class="form-input"
              style="text-transform: uppercase"
            />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <input v-model="editForm.description" class="form-input" />
          </div>

          <div class="form-group">
            <label>Tipo de descuento</label>
            <select v-model="editForm.discount_type" class="form-input">
              <option value="PERCENTAGE">Porcentaje (%)</option>
              <option value="FIXED">Monto fijo ($)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Valor</label>
            <input
              v-model.number="editForm.discount_value"
              type="number"
              min="0"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Usos máximos totales</label>
            <input
              v-model.number="editForm.max_uses"
              type="number"
              min="1"
              class="form-input"
              placeholder="Vacío = ilimitado"
            />
          </div>
          <div class="form-group">
            <label>Usos máximos por usuario</label>
            <input
              v-model.number="editForm.usage_limit_per_user"
              type="number"
              min="1"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Monto mínimo de pedido</label>
            <input
              v-model.number="editForm.min_order_amount"
              type="number"
              min="0"
              class="form-input"
              placeholder="Vacío = sin mínimo"
            />
          </div>
          <div class="form-group">
            <label>Estado</label>
            <label class="toggle-label">
              <input v-model="editForm.active" type="checkbox" class="toggle-input" />
              <span class="toggle-switch"></span>
              <span>{{ editForm.active ? "Activo" : "Inactivo" }}</span>
            </label>
          </div>

          <div class="form-group">
            <label>Válido desde</label>
            <input v-model="editForm.valid_from" type="datetime-local" class="form-input" />
          </div>
          <div class="form-group">
            <label>Válido hasta</label>
            <input v-model="editForm.valid_until" type="datetime-local" class="form-input" />
          </div>

          <div class="form-group form-group--full">
            <label>URL del ícono</label>
            <input v-model="editForm.icon_url" class="form-input" placeholder="https://…" />
          </div>
          <div class="form-group form-group--full">
            <label>URL de portada <span class="optional">(opcional)</span></label>
            <input v-model="editForm.cover_url" class="form-input" placeholder="https://…" />
            <div v-if="editForm.cover_url" class="cover-preview">
              <img :src="editForm.cover_url as string" alt="Portada" />
            </div>
          </div>
        </div>

        <div class="uses-info">
          Usos actuales: <strong>{{ editingCoupon.current_uses }}</strong>
        </div>

        <div v-if="error" class="modal-error">{{ error }}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeEdit">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
            {{ saving ? "Guardando…" : "Guardar cambios" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .coupons-view {
    padding: var(--spacing-lg);
    max-width: 1200px;
    margin: 0 auto;
    min-height: 100vh;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    padding: 0.25rem var(--spacing-xs);
    transition: color var(--transition-fast);
  }
  .back-btn:hover { color: var(--color-text-primary); }

  .error-banner {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    font-size: 0.9rem;
  }

  .section {
    background: var(--bg-white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .records-total {
    font-weight: 400;
    color: var(--color-text-muted);
    font-size: 0.9em;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .search-input {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.75rem;
    font-size: 0.9rem;
    outline: none;
    min-width: 220px;
  }
  .search-input:focus { border-color: var(--color-primary); }

  .loading {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
  }
  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto var(--spacing-sm);
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
  }

  .table-container { overflow-x: auto; }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .data-table th,
  .data-table td {
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border-light);
    white-space: nowrap;
  }
  .data-table th {
    font-weight: 600;
    color: var(--color-text-secondary);
    background: var(--bg-subtle, #f9fafb);
  }
  .data-table tbody tr:hover { background: var(--bg-subtle, #f9fafb); }

  .coupon-code-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .coupon-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .coupon-code {
    font-family: monospace;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .discount-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .badge-pct { background: #ede9fe; color: #5b21b6; }
  .badge-fixed { background: #dcfce7; color: #166534; }

  .status-dot {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .status-dot::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot-active { color: #166534; }
  .dot-active::before { background: #22c55e; }
  .dot-inactive { color: #6b7280; }
  .dot-inactive::before { background: #9ca3af; }

  .text-muted { color: var(--color-text-muted, #6b7280); }

  .actions-cell {
    display: flex;
    gap: 0.4rem;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.5rem 1rem;
    transition: opacity 0.15s;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 0.3rem 0.65rem; font-size: 0.8rem; }
  .btn-primary { background: var(--color-primary, #6366f1); color: #fff; }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }
  .btn-secondary { background: var(--bg-subtle, #f3f4f6); color: var(--color-text-primary); border: 1px solid var(--border-light); }
  .btn-secondary:hover:not(:disabled) { background: #e5e7eb; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-danger:hover:not(:disabled) { background: #dc2626; }
  .btn-add { background: var(--color-primary, #6366f1); color: #fff; }
  .btn-add:hover { opacity: 0.88; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .modal {
    background: #fff;
    border-radius: var(--radius-lg, 12px);
    padding: var(--spacing-lg);
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  }
  .modal-lg { max-width: 680px; }

  .modal h3 {
    margin: 0 0 var(--spacing-md);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm) var(--spacing-md);
  }

  .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
  .form-group--full { grid-column: 1 / -1; }

  .form-group label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .required { color: #ef4444; }
  .optional { font-weight: 400; color: var(--color-text-muted); }

  .form-input {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.65rem;
    font-size: 0.9rem;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--color-primary); }

  /* Toggle switch */
  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding-top: 0.3rem;
    font-size: 0.9rem;
    color: var(--color-text-primary);
  }
  .toggle-input { display: none; }
  .toggle-switch {
    width: 36px;
    height: 20px;
    background: #d1d5db;
    border-radius: 9999px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle-switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle-input:checked + .toggle-switch { background: var(--color-primary, #6366f1); }
  .toggle-input:checked + .toggle-switch::after { transform: translateX(16px); }

  .cover-preview {
    margin-top: 0.5rem;
    border-radius: var(--radius-sm);
    overflow: hidden;
    max-height: 120px;
  }
  .cover-preview img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
  }

  .uses-info {
    margin: var(--spacing-sm) 0;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .modal-error {
    background: #fee2e2;
    color: #991b1b;
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    margin-top: var(--spacing-sm);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }

  @media (max-width: 600px) {
    .form-grid { grid-template-columns: 1fr; }
    .form-group--full { grid-column: 1; }
    .section-header { flex-direction: column; align-items: flex-start; }
  }
</style>
