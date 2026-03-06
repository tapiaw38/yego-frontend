<script setup lang="ts">
  import { ref, onMounted, computed, watch } from "vue";
  import { useRouter } from "vue-router";
  import * as XLSX from "xlsx";
  import { importsService } from "../api/importsService";
  import { uploadService } from "../api/uploadService";
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

  // Column definitions — persisted in localStorage so they survive reload
  const STORAGE_KEY = "imports_manual_columns";
  const storedCols = localStorage.getItem(STORAGE_KEY);
  const manualColumns = ref<Array<{ key: string; type: "text" | "file" }>>(
    storedCols ? JSON.parse(storedCols) : []
  );
  const showColInput = ref(false);
  const newColKey = ref("");
  const newColType = ref<"text" | "file">("text");

  watch(manualColumns, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  }, { deep: true });

  const fileTypeKeys = computed(() =>
    new Set(manualColumns.value.filter((c) => c.type === "file").map((c) => c.key))
  );

  function addColumn() {
    const k = newColKey.value.trim();
    if (!k) return;
    if (manualColumns.value.some((c) => c.key === k) || visibleDataKeys.value.includes(k)) return;
    manualColumns.value.push({ key: k, type: newColType.value });
    newColKey.value = "";
    newColType.value = "text";
    showColInput.value = false;
  }

  // When a new column is added while the create modal is open, add it to the form
  watch(manualColumns, (cols) => {
    if (!showCreateModal.value) return;
    cols.forEach((c) => {
      if (!(c.key in createForm.value.data)) {
        createForm.value.data[c.key] = "";
      }
    });
  }, { deep: true });

  // Edit
  const editingRecord = ref<ImportRecord | null>(null);
  const editForm = ref<{ data: Record<string, unknown>; profile_id: string }>({
    data: {},
    profile_id: "",
  });
  const editPendingFiles = ref<Record<string, File>>({});

  // Create
  const showCreateModal = ref(false);
  const creating = ref(false);
  const createForm = ref<{ data: Record<string, string>; profile_id: string }>({
    data: {},
    profile_id: "",
  });
  const createPendingFiles = ref<Record<string, File>>({});

  function openCreate() {
    const template: Record<string, string> = {};
    visibleDataKeys.value.forEach((k) => { template[k] = ""; });
    createForm.value = { data: template, profile_id: "" };
    createPendingFiles.value = {};
    showCreateModal.value = true;
  }

  function closeCreate() {
    showCreateModal.value = false;
  }

  function onCreateFileChange(e: Event, key: string) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) createPendingFiles.value[key] = file;
  }

  function removeCreateField(key: string) {
    const { [key]: _, ...rest } = createForm.value.data;
    createForm.value.data = rest;
    const { [key]: _f, ...restFiles } = createPendingFiles.value;
    createPendingFiles.value = restFiles;
  }

  async function saveCreate() {
    if (Object.keys(createForm.value.data).length === 0) return;
    creating.value = true;
    try {
      for (const [key, file] of Object.entries(createPendingFiles.value)) {
        const url = await uploadService.upload(file);
        createForm.value.data[key] = url;
      }
      const profileId = createForm.value.profile_id.trim() || null;
      await importsService.create({
        data: createForm.value.data as Record<string, unknown>,
        profile_id: profileId,
      });
      await loadRecords();
      closeCreate();
    } catch (err) {
      console.error("Error creating record:", err);
    } finally {
      creating.value = false;
    }
  }

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
    const data: Record<string, unknown> = { ...record.data };
    // Include any manually-added columns not yet in this record
    manualColumns.value.forEach((c) => {
      if (!(c.key in data)) data[c.key] = "";
    });
    editForm.value = { data, profile_id: record.profile_id ?? "" };
    editPendingFiles.value = {};
  }

  function closeEdit() {
    editingRecord.value = null;
  }

  function onEditFileChange(e: Event, key: string) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) editPendingFiles.value[key] = file;
  }

  function removeEditField(key: string) {
    const { [key]: _, ...rest } = editForm.value.data as Record<string, unknown>;
    editForm.value.data = rest;
    const { [key]: _f, ...restFiles } = editPendingFiles.value;
    editPendingFiles.value = restFiles;
  }

  async function saveEdit() {
    if (!editingRecord.value) return;
    saving.value = true;
    try {
      for (const [key, file] of Object.entries(editPendingFiles.value)) {
        const url = await uploadService.upload(file);
        (editForm.value.data as Record<string, unknown>)[key] = url;
      }
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

  const searchQuery = ref("");

  const filteredRecords = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return records.value;
    return records.value.filter((r) =>
      Object.values(r.data ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  });

  const visibleDataKeys = computed(() => {
    // Union of ALL records' keys (not just first) so every column is shown
    const allKeys = new Set<string>();
    records.value.forEach((r) => Object.keys(r.data ?? {}).forEach((k) => allKeys.add(k)));
    const manualKeys = manualColumns.value.map((c) => c.key).filter((k) => !allKeys.has(k));
    return [...allKeys, ...manualKeys];
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
        <h2>
          Registros ({{ filteredRecords.length }}<span v-if="searchQuery" class="records-total"> de {{ records.length }}</span>)
        </h2>
        <div class="records-toolbar">
          <input
            v-if="records.length > 0"
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Buscar en productos…"
          />
          <div class="records-actions">
            <button class="btn btn-add btn-sm" @click="openCreate">
              + Agregar producto
            </button>
            <template v-if="records.length > 0">
              <button class="btn btn-export btn-sm" @click="exportToExcel">
                Exportar Excel
              </button>
              <button class="btn btn-danger btn-sm" @click="showClearModal = true">
                Limpiar todo
              </button>
            </template>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Cargando registros…</p>
      </div>

      <div v-else-if="records.length === 0" class="empty-state">
        <p>No hay registros importados todavía.</p>
      </div>

      <div v-else-if="filteredRecords.length === 0" class="empty-state">
        <p>No se encontraron resultados para "<strong>{{ searchQuery }}</strong>".</p>
      </div>

      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th v-for="key in visibleDataKeys" :key="key">{{ key }}</th>
              <th>Fecha</th>
              <th>Acciones</th>
              <th class="th-add-col">
                <template v-if="!showColInput">
                  <button class="btn-add-col" title="Agregar columna" @click="showColInput = true">+</button>
                </template>
                <div v-else class="add-col-form">
                  <input
                    v-model="newColKey"
                    class="form-input form-input--col"
                    placeholder="Nombre columna"
                    @keyup.enter="addColumn"
                    @keyup.escape="showColInput = false"
                  />
                  <select v-model="newColType" class="form-select--type">
                    <option value="text">Texto</option>
                    <option value="file">Imagen</option>
                  </select>
                  <button class="btn-icon" title="Confirmar" @click="addColumn">✓</button>
                  <button class="btn-icon btn-icon--danger" title="Cancelar" @click="showColInput = false">✕</button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filteredRecords" :key="record.id">
              <td class="mono">{{ truncate(record.id, 8) }}</td>
              <td v-for="key in visibleDataKeys" :key="key">
                <template v-if="String(record.data?.[key] ?? '').startsWith('http')">
                  <a :href="String(record.data?.[key])" target="_blank" class="url-cell">
                    {{ truncate(String(record.data?.[key]), 30) }}
                  </a>
                </template>
                <template v-else>{{ String(record.data?.[key] ?? "") }}</template>
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
              <td></td>
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

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreate">
      <div class="modal">
        <h3>Agregar producto</h3>

        <div
          v-for="(_, key) in createForm.data"
          :key="String(key)"
          class="form-group form-group--row"
        >
          <label>{{ key }}</label>
          <div class="form-group__row">
            <label
              v-if="fileTypeKeys.has(String(key))"
              class="btn-file-pick"
              :class="{ 'has-file': createPendingFiles[String(key)] }"
            >
              {{ createPendingFiles[String(key)]?.name ?? (createForm.data[String(key)] || 'Seleccionar imagen') }}
              <input type="file" accept="image/*" class="file-input" @change="onCreateFileChange($event, String(key))" />
            </label>
            <input
              v-else
              v-model="(createForm.data as Record<string, string>)[key as string]"
              type="text"
              class="form-input"
            />
            <button class="btn-icon btn-icon--danger" title="Quitar campo" @click="removeCreateField(String(key))">✕</button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeCreate">Cancelar</button>
          <button
            class="btn btn-primary"
            :disabled="creating || Object.keys(createForm.data).length === 0"
            @click="saveCreate"
          >
            {{ creating ? "Guardando…" : "Guardar" }}
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
          class="form-group form-group--row"
        >
          <label>{{ key }}</label>
          <div class="form-group__row">
            <label
              v-if="fileTypeKeys.has(String(key))"
              class="btn-file-pick"
              :class="{ 'has-file': editPendingFiles[String(key)] }"
            >
              {{ editPendingFiles[String(key)]?.name ?? (String(editForm.data[String(key)] || 'Seleccionar imagen')) }}
              <input type="file" accept="image/*" class="file-input" @change="onEditFileChange($event, String(key))" />
            </label>
            <input
              v-else
              v-model="(editForm.data as Record<string, unknown>)[key] as string"
              type="text"
              class="form-input"
            />
            <button class="btn-icon btn-icon--danger" title="Quitar campo" @click="removeEditField(String(key))">✕</button>
          </div>
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

  .back-btn:hover {
    color: var(--color-text-primary);
  }

  .upload-section,
  .records-section {
    background: var(--bg-white);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .upload-section h2,
  .records-section h2 {
    margin: 0 0 var(--spacing-md);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .records-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .records-header h2 {
    margin: 0;
  }

  .records-total {
    font-weight: 400;
    color: var(--color-text-muted);
    font-size: 0.9em;
  }

  .records-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .search-input {
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    width: 220px;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .records-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .btn-add {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }

  .btn-add:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 22%, transparent);
  }

  .btn-export {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success);
  }

  .btn-export:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-success) 25%, transparent);
  }

  .form-group--row .form-group__row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .form-group--row .form-group__row .form-input {
    flex: 1;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    line-height: 1;
  }

  .btn-icon--danger {
    color: var(--color-danger);
  }

  .btn-icon--danger:hover {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  }

  .add-field-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-top: var(--spacing-sm);
    border-top: 1px dashed var(--border-light);
  }

  .form-input--key {
    max-width: 140px;
  }

  .th-add-col {
    white-space: nowrap;
    width: 1%;
    position: relative;
  }

  .btn-add-col {
    background: none;
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.5rem;
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }

  .btn-add-col:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .add-col-form {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg-white);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 10;
    min-width: 320px;
  }

  .form-input--col {
    flex: 1;
    padding: 0.4rem 0.6rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    min-width: 0;
  }

  .form-select--type {
    padding: 0.45rem 0.5rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    background: var(--bg-white);
    color: var(--color-text-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-file-pick {
    flex: 1;
    display: inline-flex;
    align-items: center;
    padding: 0.45rem 0.75rem;
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }

  .btn-file-pick:hover,
  .btn-file-pick.has-file {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-file-pick .file-input {
    display: none;
  }

  .upload-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .file-input {
    display: none;
  }

  .file-label {
    display: inline-block;
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    min-width: 240px;
    text-align: center;
    transition:
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .file-label:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .import-success {
    margin-top: var(--spacing-sm);
    color: var(--color-success);
    font-size: 0.9rem;
  }

  .btn {
    padding: var(--spacing-xs) 1.25rem;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background var(--transition-fast);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-primary);
    color: var(--color-text-white);
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  .btn-secondary {
    background: var(--bg-light);
    color: var(--vt-c-gray-700);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .btn-sm {
    padding: 0.3rem 0.75rem;
    font-size: 0.8rem;
  }

  .btn-danger {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger);
  }

  .btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-danger) 30%, transparent);
  }

  .actions-cell {
    display: flex;
    gap: 0.4rem;
  }

  .loading {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--spacing-sm);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
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
    border-bottom: 1px solid var(--bg-light);
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .data-table th {
    font-weight: 600;
    color: var(--vt-c-gray-700);
    background: var(--vt-c-gray-50);
  }

  .data-table tbody tr:hover {
    background: var(--surface-hover);
  }

  .mono {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .url-cell {
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .url-cell:hover {
    text-decoration: underline;
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
    background: var(--bg-white);
    border-radius: var(--radius-md);
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
    color: var(--color-text-primary);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--vt-c-gray-700);
    margin-bottom: 0.35rem;
  }

  .form-input {
    width: 100%;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    box-sizing: border-box;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .modal-actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
    margin-top: var(--spacing-lg);
  }

  .modal-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 2.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .warning-text {
    color: var(--vt-c-gray-700);
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 0;
  }

  .modal-warning .modal-actions {
    justify-content: center;
  }
</style>
