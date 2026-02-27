<script setup lang="ts">
import Tag from 'primevue/tag'

interface Props {
  status: string
  size?: 'small' | 'normal' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'normal'
})

const statusConfig: Record<string, { severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast', icon: string, label: string }> = {
  CREATED: { severity: 'secondary', icon: 'pi pi-file', label: 'Creado' },
  CONFIRMED: { severity: 'info', icon: 'pi pi-check-circle', label: 'Confirmado' },
  PREPARING: { severity: 'warn', icon: 'pi pi-spinner pi-spin', label: 'En Preparación' },
  ON_THE_WAY: { severity: 'info', icon: 'pi pi-truck', label: 'En Camino' },
  DELIVERED: { severity: 'success', icon: 'pi pi-check', label: 'Entregado' },
  CANCELLED: { severity: 'danger', icon: 'pi pi-times', label: 'Cancelado' },
  PAUSED: { severity: 'warn', icon: 'pi pi-pause', label: 'Pausado' },
  MODIFICATION_REQUESTED: { severity: 'warn', icon: 'pi pi-pencil', label: 'Modificación' },
}

const config = statusConfig[props.status] || { severity: 'secondary', icon: 'pi pi-question', label: props.status }
</script>

<template>
  <Tag
    :value="config.label"
    :severity="config.severity"
    :icon="config.icon"
    :class="['status-badge', `status-${status.toLowerCase().replace(/_/g, '-')}`, `size-${size}`]"
  />
</template>

<style scoped>
.status-badge {
  font-weight: 600;
  letter-spacing: 0.025em;
  border-width: 1px;
  border-style: solid;
}

.status-badge.size-small {
  font-size: 0.625rem;
  padding: var(--spacing-xs) calc(var(--spacing-xs) * 1.25);
}

.status-badge.size-normal {
  font-size: 0.75rem;
  padding: calc(var(--spacing-xs) * 0.75) var(--spacing-sm);
}

.status-badge.size-large {
  font-size: 0.875rem;
  padding: var(--spacing-xs) var(--spacing-md);
}

:deep(.status-created) {
  background: linear-gradient(135deg, var(--vt-c-gray-100) 0%, var(--vt-c-gray-200) 100%);
  color: var(--vt-c-gray-600);
  border-color: var(--vt-c-gray-300);
}

:deep(.status-confirmed) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-info) 12%, white) 0%, color-mix(in srgb, var(--color-info) 22%, white) 100%);
  color: var(--color-info-dark);
  border-color: color-mix(in srgb, var(--color-info) 40%, white);
}

:deep(.status-preparing) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-warning) 12%, white) 0%, color-mix(in srgb, var(--color-warning) 25%, white) 100%);
  color: var(--color-warning-dark);
  border-color: color-mix(in srgb, var(--color-warning) 45%, white);
}

:deep(.status-on-the-way) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, white) 0%, color-mix(in srgb, var(--color-primary) 22%, white) 100%);
  color: var(--color-primary-dark);
  border-color: color-mix(in srgb, var(--color-primary) 35%, white);
}

:deep(.status-delivered) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-success) 12%, white) 0%, color-mix(in srgb, var(--color-success) 25%, white) 100%);
  color: var(--color-success-dark);
  border-color: color-mix(in srgb, var(--color-success) 40%, white);
}

:deep(.status-cancelled) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 12%, white) 0%, color-mix(in srgb, var(--color-danger) 22%, white) 100%);
  color: var(--color-danger-dark);
  border-color: color-mix(in srgb, var(--color-danger) 40%, white);
}

:deep(.status-paused) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-warning) 12%, white) 0%, color-mix(in srgb, var(--color-warning) 25%, white) 100%);
  color: var(--color-warning-dark);
  border-color: color-mix(in srgb, var(--color-warning) 45%, white);
}

:deep(.status-modification-requested) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-warning) 18%, white) 0%, color-mix(in srgb, var(--color-warning-dark) 28%, white) 100%);
  color: var(--color-warning-dark);
  border-color: color-mix(in srgb, var(--color-warning-dark) 45%, white);
}
</style>
