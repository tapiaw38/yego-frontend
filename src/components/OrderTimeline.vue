<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '../types/order'
import { StatusLabels, StatusIcons } from '../types/order'

const props = defineProps<{
  order: Order
}>()

// Special statuses that should only show as banners when active
const specialStatuses = ['CANCELLED', 'PAUSED', 'MODIFICATION_REQUESTED']

const timelineStatuses = computed(() => {
  // Filter out special statuses from the normal timeline
  const normalStatuses = props.order.all_statuses.filter(s => !specialStatuses.includes(s))

  return normalStatuses.map((status, index) => {
    const isCurrent = status === props.order.status
    const isCompleted = index < props.order.status_index
    const isPending = index > props.order.status_index

    return {
      status,
      label: StatusLabels[status] || status,
      icon: StatusIcons[status] || 'pi-circle',
      isCurrent,
      isCompleted,
      isPending
    }
  })
})

const isCancelled = computed(() => props.order.status === 'CANCELLED')
const isPaused = computed(() => props.order.status === 'PAUSED')
const isModificationRequested = computed(() => props.order.status === 'MODIFICATION_REQUESTED')
</script>

<template>
  <div class="timeline-container">
    <!-- Cancelled State -->
    <div v-if="isCancelled" class="status-banner status-banner--danger">
      <div class="status-banner__icon-wrap status-banner__icon-wrap--danger">
        <i class="pi pi-times-circle"></i>
      </div>
      <div class="status-banner__body">
        <span class="status-banner__title text-danger">Pedido Cancelado</span>
        <span class="status-banner__subtitle text-gray-500">Este pedido ha sido cancelado y no puede ser procesado.</span>
      </div>
    </div>

    <!-- Paused State -->
    <div v-else-if="isPaused" class="status-banner status-banner--warning">
      <div class="status-banner__icon-wrap status-banner__icon-wrap--warning">
        <i class="pi pi-pause-circle"></i>
      </div>
      <div class="status-banner__body">
        <span class="status-banner__title text-warning">Pedido Pausado</span>
        <span class="status-banner__subtitle text-gray-500">Tu pedido está en pausa temporalmente.</span>
      </div>
    </div>

    <!-- Modification Requested State -->
    <div v-else-if="isModificationRequested" class="status-banner status-banner--info">
      <div class="status-banner__icon-wrap status-banner__icon-wrap--info">
        <i class="pi pi-pencil"></i>
      </div>
      <div class="status-banner__body">
        <span class="status-banner__title text-info">Modificación Solicitada</span>
        <span class="status-banner__subtitle text-gray-500">El administrador revisará tu solicitud de cambio.</span>
      </div>
    </div>

    <!-- Normal Timeline -->
    <ol v-else class="timeline" aria-label="Estado del pedido">
      <li
        v-for="(item, index) in timelineStatuses"
        :key="item.status"
        class="timeline-item"
        :class="{
          'timeline-item--completed': item.isCompleted,
          'timeline-item--current': item.isCurrent,
          'timeline-item--pending': item.isPending
        }"
      >
        <div class="timeline-item__track">
          <div class="timeline-item__marker" :aria-label="item.label">
            <i v-if="item.isCompleted" class="pi pi-check"></i>
            <i v-else :class="['pi', item.icon]"></i>
          </div>
          <div v-if="index < timelineStatuses.length - 1" class="timeline-item__line"></div>
        </div>

        <div class="timeline-item__content">
          <span class="timeline-item__label">{{ item.label }}</span>
          <span v-if="item.isCurrent" class="timeline-item__current-chip">En curso</span>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.timeline-container {
  padding: var(--spacing-sm) var(--spacing-md);
}

/* ---- Status Banners ---- */
.status-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1.5px solid;
}

.status-banner--danger {
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
}

.status-banner--warning {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
}

.status-banner--info {
  background: color-mix(in srgb, var(--color-info) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
}

.status-banner__icon-wrap {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
  flex-shrink: 0;
}

.status-banner__icon-wrap--danger {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}

.status-banner__icon-wrap--warning {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}

.status-banner__icon-wrap--info {
  background: color-mix(in srgb, var(--color-info) 15%, transparent);
  color: var(--color-info);
}

.status-banner__body {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.status-banner__title {
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.2;
}

.status-banner__subtitle {
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* ---- Timeline ---- */
.timeline {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.timeline-item__track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.timeline-item__marker {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  transition: all var(--transition-normal);
  position: relative;
  z-index: 1;
}

.timeline-item__line {
  width: 2px;
  flex: 1;
  min-height: 2.25rem;
  transition: background var(--transition-normal);
}

/* Completed */
.timeline-item--completed .timeline-item__marker {
  background: var(--gradient-success);
  color: var(--color-text-white);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-success) 40%, transparent);
}

.timeline-item--completed .timeline-item__line {
  background: var(--color-success);
}

.timeline-item--completed .timeline-item__label {
  color: var(--color-success-dark);
  font-weight: 600;
}

/* Current */
.timeline-item--current .timeline-item__marker {
  background: var(--gradient-warning);
  color: var(--color-text-white);
  box-shadow: 0 4px 18px color-mix(in srgb, var(--color-warning) 45%, transparent);
  animation: pulse-marker 2.2s ease-in-out infinite;
}

.timeline-item--current .timeline-item__line {
  background: linear-gradient(to bottom, var(--color-warning), var(--vt-c-gray-200));
}

.timeline-item--current .timeline-item__label {
  color: var(--color-warning-dark);
  font-weight: 700;
}

/* Pending */
.timeline-item--pending .timeline-item__marker {
  background: var(--vt-c-gray-100);
  color: var(--vt-c-gray-400);
  border: 2px solid var(--border-light);
}

.timeline-item--pending .timeline-item__line {
  background: var(--border-light);
}

.timeline-item--pending .timeline-item__label {
  color: var(--vt-c-gray-400);
}

/* Content */
.timeline-item__content {
  padding-top: 0.6rem;
  padding-bottom: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.timeline-item__label {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
}

.timeline-item__current-chip {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--gradient-warning);
  color: var(--color-text-white);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}

/* No trailing line on last item */
.timeline-item:last-child .timeline-item__line {
  display: none;
}

@keyframes pulse-marker {
  0%, 100% { transform: scale(1); box-shadow: 0 4px 18px color-mix(in srgb, var(--color-warning) 40%, transparent); }
  50% { transform: scale(1.07); box-shadow: 0 6px 24px color-mix(in srgb, var(--color-warning) 55%, transparent); }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-item--current .timeline-item__marker {
    animation: none;
  }
}
</style>
