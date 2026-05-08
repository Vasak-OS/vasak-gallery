<script setup lang="ts">
/**
 * Panel de estado centrado: loading, error o empty.
 * Slot por defecto para el contenido, slot "action" para botones.
 */
defineProps<{
	type: 'loading' | 'error' | 'empty';
	message?: string;
}>();
</script>

<template>
  <div class="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">

    <!-- Loading -->
    <template v-if="type === 'loading'">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-ui-border border-t-primary" />
      <p class="text-sm text-tx-muted">{{ message ?? 'Cargando...' }}</p>
    </template>

    <!-- Error -->
    <template v-else-if="type === 'error'">
      <p class="text-sm text-status-error">{{ message }}</p>
      <slot name="action" />
    </template>

    <!-- Empty -->
    <template v-else>
      <p class="text-sm text-tx-muted">{{ message ?? 'Sin contenido' }}</p>
      <slot name="action" />
    </template>

  </div>
</template>
