<script setup lang="ts">
import Card from 'primevue/card'

interface Props {
  title: string
  value: string | number
  icon: string
  trend?: number
  trendLabel?: string
  color?: 'primary' | 'success' | 'info' | 'warn' | 'danger'
}

withDefaults(defineProps<Props>(), {
  color: 'primary',
  trend: 0,
  trendLabel: ''
})

const colorClasses: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  info: 'bg-info',
  warn: 'bg-warn',
  danger: 'bg-danger'
}
</script>

<template>
  <Card class="stat-card card-modern hover-lift">
    <template #content>
      <div class="stat-content">
        <div :class="['stat-icon', colorClasses[color]]">
          <i :class="icon"></i>
        </div>
        <div class="stat-info">
          <span class="stat-title">{{ title }}</span>
          <span class="stat-value">{{ value }}</span>
          <div v-if="trend !== 0" class="stat-trend">
            <i :class="trend > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
            <span :class="trend > 0 ? 'text-success' : 'text-danger'">
              {{ Math.abs(trend) }}% {{ trendLabel }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.stat-content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon i {
  font-size: 1.25rem;
  color: var(--color-text-white);
}

.stat-icon.bg-primary {
  background: var(--gradient-primary);
}

.stat-icon.bg-success {
  background: var(--gradient-success);
}

.stat-icon.bg-info {
  background: var(--gradient-info);
}

.stat-icon.bg-warn {
  background: var(--gradient-warning);
}

.stat-icon.bg-danger {
  background: var(--gradient-danger);
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-title {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.stat-trend i {
  font-size: 0.625rem;
}
</style>
