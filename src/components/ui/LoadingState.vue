<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'

interface Props {
  message?: string
  fullscreen?: boolean
}

withDefaults(defineProps<Props>(), {
  message: 'Cargando...',
  fullscreen: false
})
</script>

<template>
  <div :class="['loading-state', { fullscreen }]">
    <div class="loading-content">
      <ProgressSpinner
        strokeWidth="4"
        class="loading-spinner"
      />
      <p class="loading-message">{{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.loading-state.fullscreen {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg-white) 92%, transparent);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.loading-spinner {
  width: 50px;
  height: 50px;
}

:deep(.loading-spinner circle) {
  stroke: var(--color-primary);
  stroke-linecap: round;
  animation: spinner-dash 1.5s ease-in-out infinite;
}

@keyframes spinner-dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.loading-message {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  font-weight: 500;
  margin: 0;
}

.loading-state.inline {
  padding: var(--spacing-md);
}

.loading-state.inline .loading-spinner {
  width: 24px;
  height: 24px;
}

.loading-state.inline .loading-message {
  font-size: 0.875rem;
}
</style>
