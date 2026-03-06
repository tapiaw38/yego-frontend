<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { uploadService } from '../api/uploadService'

const router = useRouter()

const selectedFile = ref<File | null>(null)
const preview = ref<string | null>(null)
const uploading = ref(false)
const uploadedUrl = ref<string | null>(null)
const error = ref<string | null>(null)
const copied = ref(false)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedFile.value = file
  uploadedUrl.value = null
  error.value = null
  copied.value = false
  if (file) {
    preview.value = URL.createObjectURL(file)
  } else {
    preview.value = null
  }
}

async function upload() {
  if (!selectedFile.value) return
  uploading.value = true
  error.value = null
  try {
    uploadedUrl.value = await uploadService.upload(selectedFile.value)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Error al subir imagen'
  } finally {
    uploading.value = false
  }
}

function copyUrl() {
  if (!uploadedUrl.value) return
  navigator.clipboard.writeText(uploadedUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function reset() {
  selectedFile.value = null
  preview.value = null
  uploadedUrl.value = null
  error.value = null
  copied.value = false
  const input = document.getElementById('img-input') as HTMLInputElement
  if (input) input.value = ''
}
</script>

<template>
  <div class="images-view">
    <header class="page-header">
      <button class="back-btn" @click="router.push('/admin')">← Volver</button>
      <h1>Subir imágenes</h1>
    </header>

    <section class="upload-card">
      <div class="drop-area" :class="{ 'has-preview': preview }">
        <img v-if="preview" :src="preview" class="preview-img" alt="preview" />
        <div v-else class="drop-placeholder">
          <span class="drop-icon">🖼️</span>
          <p>Seleccioná una imagen</p>
          <p class="drop-hint">JPG, PNG, WEBP — hasta 5MB</p>
        </div>
        <label class="file-overlay" for="img-input" />
        <input
          id="img-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="file-input"
          @change="onFileChange"
        />
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          :disabled="!selectedFile || uploading"
          @click="upload"
        >
          {{ uploading ? 'Subiendo…' : 'Subir a S3' }}
        </button>
        <button v-if="selectedFile" class="btn btn-secondary" @click="reset">
          Limpiar
        </button>
      </div>

      <p v-if="error" class="msg msg--error">{{ error }}</p>

      <div v-if="uploadedUrl" class="result">
        <p class="result-label">URL pública:</p>
        <div class="url-row">
          <input :value="uploadedUrl" readonly class="url-input" />
          <button class="btn btn-copy" @click="copyUrl">
            {{ copied ? '✓ Copiado' : 'Copiar' }}
          </button>
        </div>
        <img :src="uploadedUrl" class="result-img" alt="imagen subida" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.images-view {
  padding: var(--spacing-lg);
  max-width: 600px;
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
}

.back-btn:hover { color: var(--color-text-primary); }

.upload-card {
  background: var(--bg-white);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
}

.drop-area {
  position: relative;
  border: 2px dashed var(--border-default);
  border-radius: var(--radius-md);
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition-fast);
  margin-bottom: var(--spacing-md);
}

.drop-area:hover { border-color: var(--color-primary); }

.drop-placeholder {
  text-align: center;
  color: var(--color-text-muted);
  pointer-events: none;
}

.drop-icon { font-size: 2.5rem; display: block; margin-bottom: var(--spacing-sm); }

.drop-hint { font-size: 0.8rem; margin-top: 0.25rem; }

.preview-img {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  pointer-events: none;
}

.file-overlay {
  position: absolute;
  inset: 0;
  cursor: pointer;
}

.file-input { display: none; }

.actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
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

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary { background: var(--color-primary); color: var(--color-text-white); }
.btn-primary:hover:not(:disabled) { filter: brightness(0.9); }

.btn-secondary { background: var(--bg-light); color: var(--vt-c-gray-700); }
.btn-secondary:hover:not(:disabled) { background: var(--surface-hover); }

.btn-copy {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  white-space: nowrap;
}

.msg { font-size: 0.9rem; margin-bottom: var(--spacing-sm); }
.msg--error { color: var(--color-danger); }

.result { margin-top: var(--spacing-md); }

.result-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--vt-c-gray-700);
  margin-bottom: 0.35rem;
}

.url-row {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.url-input {
  flex: 1;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-family: monospace;
  background: var(--bg-light);
  color: var(--color-text-primary);
}

.result-img {
  max-width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
}
</style>
