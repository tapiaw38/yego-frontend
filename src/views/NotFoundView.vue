<script setup lang="ts">
</script>

<template>
  <div class="not-found gradient-background">
    <div class="not-found-background" aria-hidden="true">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <div class="not-found-card">
      <div class="icon-wrap gradient-primary">
        <i class="pi pi-search text-white"></i>
      </div>
      <h1 class="text-gray-800">Pagina no encontrada</h1>
      <p class="text-gray-500">El enlace que seguiste no existe o ha expirado.</p>
      <p class="hint text-gray-400">Verifica el link que recibiste por WhatsApp</p>
    </div>
  </div>
</template>

<style scoped>
  .not-found {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
    position: relative;
    overflow: hidden;
  }

  /* Animated background shapes — consistent with ClaimOrderView / LoginView */
  .not-found-background {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .shape {
    position: absolute;
    background: var(--bg-transparent);
    border-radius: 50%;
    animation: float 6s ease-in-out infinite;
  }

  .shape-1 {
    width: 300px;
    height: 300px;
    top: -100px;
    left: -100px;
    animation-delay: 0s;
  }

  .shape-2 {
    width: 200px;
    height: 200px;
    bottom: -50px;
    right: -50px;
    animation-delay: 3s;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-20px) rotate(10deg); }
  }

  /* Card */
  .not-found-card {
    position: relative;
    z-index: 10;
    background: var(--surface-card);
    padding: var(--spacing-2xl) var(--spacing-xl);
    border-radius: var(--radius-xl);
    text-align: center;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 25px 50px var(--shadow-heavy);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    animation: slideUp var(--transition-slow) ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Icon */
  .icon-wrap {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin-bottom: var(--spacing-xs);
    box-shadow: 0 8px 32px var(--shadow-medium);
  }

  /* Typography */
  h1 {
    font-size: 1.375rem;
    font-weight: var(--font-semibold);
    margin: 0;
  }

  p {
    margin: 0;
    line-height: 1.6;
  }

  .hint {
    font-size: 0.875rem;
    margin-top: calc(var(--spacing-xs) * -0.5);
  }

  /* Mobile */
  @media (max-width: 480px) {
    .not-found-card {
      padding: var(--spacing-xl) var(--spacing-lg);
    }
  }
</style>
