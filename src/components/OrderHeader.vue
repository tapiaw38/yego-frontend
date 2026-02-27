<script setup lang="ts">
import type { Order } from '../types/order'
import { StatusLabels, StatusIcons } from '../types/order'
import { computed } from 'vue'

const props = defineProps<{
  order: Order
}>()

const formattedDate = computed(() => {
  const date = new Date(props.order.created_at)
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const currentStatusLabel = computed(() => StatusLabels[props.order.status] || props.order.status)
const currentStatusIcon = computed(() => StatusIcons[props.order.status] || 'pi-box')
</script>

<template>
  <div class="order-header gradient-primary">
    <div class="order-header__top">
      <div class="order-header__id-block">
        <span class="order-header__id-label">Pedido</span>
        <span class="order-header__id">#{{ order.id.slice(0, 8).toUpperCase() }}</span>
      </div>

      <div class="order-header__status-badge">
        <i :class="['pi', currentStatusIcon]"></i>
        <span>{{ currentStatusLabel }}</span>
      </div>
    </div>

    <div class="order-header__meta">
      <div class="order-header__meta-item">
        <span class="order-header__meta-label">
          <i class="pi pi-calendar"></i> Creado
        </span>
        <span class="order-header__meta-value">{{ formattedDate }}</span>
      </div>
      <div v-if="order.eta" class="order-header__meta-item">
        <span class="order-header__meta-label">
          <i class="pi pi-clock"></i> Tiempo estimado
        </span>
        <span class="order-header__eta-chip">{{ order.eta }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-header {
  color: var(--color-text-white);
  padding: var(--spacing-lg);
  border-radius: var(--radius-xl);
  margin-bottom: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.order-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.order-header__id-block {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.order-header__id-label {
  font-size: 0.8125rem;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.order-header__id {
  font-size: 1.375rem;
  font-weight: 700;
  font-family: 'Courier New', Courier, monospace;
  letter-spacing: 0.03em;
}

.order-header__status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--border-white);
  border: 1px solid var(--border-white);
  padding: 0.375rem var(--spacing-sm);
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.875rem;
  backdrop-filter: blur(8px);
}

.order-header__meta {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--border-white);
}

.order-header__meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
}

.order-header__meta-label {
  font-size: 0.8125rem;
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.order-header__meta-value {
  font-size: 0.875rem;
  font-weight: 500;
}

.order-header__eta-chip {
  background: var(--border-white);
  border: 1px solid var(--border-white);
  padding: 0.1875rem var(--spacing-sm);
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
}
</style>
