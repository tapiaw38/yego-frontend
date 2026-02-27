<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { useRouter } from "vue-router";
  import * as XLSX from "xlsx";
  import { importsService } from "../api/importsService";
  import type { ImportRecord } from "../types/import";

  const router = useRouter();

  const records = ref<ImportRecord[]>([]);
  const loading = ref(true);
  const uploading = ref(false);
  const saving = ref(false);
  const deleting = ref<string | null>(null);
  const showClearModal = ref(false);
  const clearing = ref(false);

  const selectedFile = ref<File | null>(null);
  const importedCount = ref<number | null>(null);

  const editingRecord = ref<ImportRecord | null>(null);
  const editForm = ref<{ data: Record<string, unknown>; profile_id: string }>({
    data: {},
    profile_id: "",
  });

  async function loadRecords() {
    loading.value = true;
    try {
      const response = await importsService.getAll();
      records.value = response.records ?? [];
    } finally {
      loading.value = false;
    }
  }

  onMounted(loadRecords);

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedFile.value = input.files?.[0] ?? null;
    importedCount.value = null;
  }

  async function uploadFile() {
    if (!selectedFile.value) return;
    uploading.value = true;
    try {
      const result = await importsService.uploadFile(selectedFile.value);
      importedCount.value = result.imported;
      selectedFile.value = null;
      const fileInput = document.getElementById(
        "file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await loadRecords();
    } catch (err) {
      console.error("Error uploading file:", err);
    } finally {
      uploading.value = false;
    }
  }

  async function clearAll() {
    clearing.value = true;
    try {
      await importsService.clearAll();
      showClearModal.value = false;
      await loadRecords();
    } catch (err) {
      console.error("Error clearing records:", err);
    } finally {
      clearing.value = false;
    }
  }

  async function deleteRecord(record: ImportRecord) {
    if (
      !confirm(
        `¿Eliminar el registro ${record.id.slice(0, 8)}…? Esta acción no se puede deshacer.`,
      )
    )
      return;
    deleting.value = record.id;
    try {
      await importsService.delete(record.id);
      await loadRecords();
    } catch (err) {
      console.error("Error deleting record:", err);
    } finally {
      deleting.value = null;
    }
  }

  function openEdit(record: ImportRecord) {
    editingRecord.value = record;
    editForm.value = {
      data: { ...record.data },
      profile_id: record.profile_id ?? "",
    };
  }

  function closeEdit() {
    editingRecord.value = null;
  }

  async function saveEdit() {
    if (!editingRecord.value) return;
    saving.value = true;
    try {
      const profileId = editForm.value.profile_id.trim() || null;
      await importsService.update(editingRecord.value.id, {
        data: editForm.value.data,
        profile_id: profileId,
      });
      await loadRecords();
      closeEdit();
    } catch (err) {
      console.error("Error saving record:", err);
    } finally {
      saving.value = false;
    }
  }

  const visibleDataKeys = computed(() => {
    if (records.value.length === 0) return [];
    const firstRecord = records.value[0];
    return Object.keys(firstRecord?.data ?? {});
  });

  function truncate(val: string, len = 36) {
    return val.length > len ? val.slice(0, len) + "…" : val;
  }

  function exportToExcel() {
    if (records.value.length === 0) return;
    const keys = visibleDataKeys.value;
    const rows = records.value.map((r) => {
      const row: Record<string, unknown> = { ID: r.id };
      keys.forEach((k) => {
        row[k] = r.data?.[k] ?? "";
      });
      row["Fecha"] = formatDate(r.created_at);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Importaciones");
    XLSX.writeFile(
      wb,
      `importaciones_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
</script>

<template>
  <div class="imports-view">
    <header class="page-header">
      <button class="back-btn" @click="router.push('/admin')">← Volver</button>
      <h1>Importaciones</h1>
    </header>

    <!-- Upload Section -->
    <section class="upload-section">
      <h2>Subir archivo Excel</h2>
      <div class="upload-controls">
        <label class="file-label" for="file-input">
          {{
            selectedFile
              ? selectedFile.name
              : "Seleccionar archivo (.xlsx, .xls)"
          }}
        </label>
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls"
          class="file-input"
          @change="onFileChange"
        />
        <button
          class="btn btn-primary"
          :disabled="!selectedFile || uploading"
          @click="uploadFile"
        >
          {{ uploading ? "Importando…" : "Importar" }}
        </button>
      </div>
      <p v-if="importedCount !== null" class="import-success">
        ✓ {{ importedCount }} filas importadas correctamente
      </p>
    </section>

    <!-- Records Table -->
    <section class="records-section">
      <div class="records-header">
        <h2>Registros ({{ records.length }})</h2>
        <div v-if="records.length > 0" class="records-actions">
          <button class="btn btn-export btn-sm" @click="exportToExcel">
            Exportar Excel
          </button>
          <button class="btn btn-danger btn-sm" @click="showClearModal = true">
            Limpiar todo
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Cargando registros…</p>
      </div>

      <div v-else-if="records.length === 0" class="empty-state">
        <p>No hay registros importados todavía.</p>
      </div>

      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th v-for="key in visibleDataKeys" :key="key">{{ key }}</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td class="mono">{{ truncate(record.id, 8) }}</td>
              <td v-for="key in visibleDataKeys" :key="key">
                {{ String(record.data?.[key] ?? "") }}
              </td>
              <td>{{ formatDate(record.created_at) }}</td>
              <td class="actions-cell">
                <button
                  class="btn btn-sm btn-secondary"
                  @click="openEdit(record)"
                >
                  Editar
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  :disabled="deleting === record.id"
                  @click="deleteRecord(record)"
                >
                  {{ deleting === record.id ? "…" : "Eliminar" }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Clear All Modal -->
    <div
      v-if="showClearModal"
      class="modal-overlay"
      @click.self="showClearModal = false"
    >
      <div class="modal modal-warning">
        <div class="warning-icon">⚠️</div>
        <h3>Limpiar todos los registros</h3>
        <p class="warning-text">
          Esta acción eliminará
          <strong>todos los {{ records.length }} registros</strong> de la tabla
          de importaciones. Esta acción <strong>no se puede deshacer</strong>.
        </p>
        <div class="modal-actions">
          <button
            class="btn btn-secondary"
            :disabled="clearing"
            @click="showClearModal = false"
          >
            Cancelar
          </button>
          <button class="btn btn-danger" :disabled="clearing" @click="clearAll">
            {{ clearing ? "Eliminando…" : "Sí, eliminar todo" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingRecord" class="modal-overlay" @click.self="closeEdit">
      <div class="modal">
        <h3>Editar registro</h3>

        <div
          v-for="(_, key) in editForm.data"
          :key="String(key)"
          class="form-group"
        >
          <label>{{ key }}</label>
          <input
            v-model="(editForm.data as Record<string, unknown>)[key] as string"
            type="text"
            class="form-input"
          />
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeEdit">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
            {{ saving ? "Guardando…" : "Guardar" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .imports-view {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    min-height: 100vh;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
  }

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    font-size: 0.9rem;
    padding: 0.25rem 0.5rem;
  }

  .back-btn:hover {
    color: #111827;
  }

  .upload-section,
  .records-section {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .upload-section h2,
  .records-section h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: #111827;
  }

  .records-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .records-header h2 {
    margin: 0;
  }

  .records-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-export {
    background: #d1fae5;
    color: #065f46;
  }

  .btn-export:hover:not(:disabled) {
    background: #a7f3d0;
  }

  .upload-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .file-input {
    display: none;
  }

  .file-label {
    display: inline-block;
    padding: 0.5rem 1rem;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    font-size: 0.9rem;
    min-width: 240px;
    text-align: center;
  }

  .file-label:hover {
    border-color: #6366f1;
    color: #6366f1;
  }

  .import-success {
    margin-top: 0.75rem;
    color: #16a34a;
    font-size: 0.9rem;
  }

  .btn {
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #6366f1;
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #4f46e5;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-sm {
    padding: 0.3rem 0.75rem;
    font-size: 0.8rem;
  }

  .btn-danger {
    background: #fee2e2;
    color: #dc2626;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fca5a5;
  }

  .actions-cell {
    display: flex;
    gap: 0.4rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 0.75rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #9ca3af;
  }

  .table-container {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th,
  .data-table td {
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid #f3f4f6;
    white-space: nowrap;
    color: #111827;
  }

  .data-table th {
    font-weight: 600;
    color: #374151;
    background: #f9fafb;
  }

  .data-table tbody tr:hover {
    background: #f9fafb;
  }

  .mono {
    font-family: monospace;
    font-size: 0.8rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #fff;
    border-radius: 10px;
    padding: 1.75rem;
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal h3 {
    margin: 0 0 1.25rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: #111827;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .form-input {
    width: 100%;
    padding: 0.45rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .modal-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .warning-text {
    color: #374151;
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 0;
  }

  .modal-warning .modal-actions {
    justify-content: center;
  }
</style>
