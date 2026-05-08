<script setup lang="ts">
/**
 * Botón reutilizable con variantes del sistema de diseño Vasak.
 */
withDefaults(defineProps<{
	variant?: 'default' | 'primary' | 'ghost' | 'danger';
	size?: 'sm' | 'md';
	disabled?: boolean;
}>(), {
	variant: 'default',
	size: 'md',
	disabled: false,
});
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 rounded-corner border font-medium transition
           disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      // sizes
      'px-3 py-1.5 text-sm': size === 'sm',
      'px-4 py-2 text-sm':   size === 'md',
      // variants
      'border-ui-border bg-ui-surface/80 text-tx-main hover:border-secondary hover:bg-primary/15':
        variant === 'default',
      'border-secondary bg-primary/15 text-tx-main hover:bg-secondary/20':
        variant === 'primary',
      'border-transparent bg-transparent text-tx-muted hover:bg-ui-surface/60 hover:text-tx-main':
        variant === 'ghost',
      'border-status-error/40 bg-status-error/10 text-status-error hover:bg-status-error/20':
        variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
