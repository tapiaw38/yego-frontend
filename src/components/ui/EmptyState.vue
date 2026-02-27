<script setup lang="ts">
import Button from 'primevue/button'

interface Props {
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-icon">
      <i :class="icon || 'pi pi-inbox'"></i>
    </div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="description" class="empty-state-description">{{ description }}</p>
    <Button
      v-if="actionLabel"
      :label="actionLabel"
      :icon="actionIcon"
      class="mt-4"
      severity="primary"
      @click="emit('action')"
    />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  text-align: center;
  min-height: 300px;
}

.empty-state-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--vt-c-gray-100) 0%, var(--vt-c-gray-200) 100%);
  border: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-lg);
}

.empty-state-icon i {
  font-size: 2rem;
  color: var(--vt-c-gray-400);
}

.empty-state-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-xs);
}

.empty-state-description {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 300px;
  line-height: 1.6;
}

.empty-state.compact {
  padding: var(--spacing-xl) var(--spacing-md);
  min-height: auto;
}

.empty-state.compact .empty-state-icon {
  width: 56px;
  height: 56px;
}

.empty-state.compact .empty-state-icon i {
  font-size: 1.5rem;
}

.empty-state.compact .empty-state-title {
  font-size: 1rem;
}
</style>
