<script setup lang="ts">
import { useNotification } from '@/composables/useNotification';

const { notifications } = useNotification();
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 left-1/2 z-10001 flex -translate-x-1/2 flex-col gap-2 pointer-events-none">
      <!-- Un aviso que sólo cambia de color no existe para un lector de
           pantalla. Con `role` el aviso se anuncia en voz alta, y `aria-atomic`
           hace que se lea entero y no sólo la parte que cambió. Los errores
           llevan `alert`, que interrumpe lo que se esté leyendo, porque algo
           salió mal y conviene enterarse ahora; los demás llevan `status`, que
           espera su turno para no cortar. -->
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 translate-y-2"
        move-class="transition-all duration-300"
      >
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :role="notification.type === 'error' ? 'alert' : 'status'"
          aria-atomic="true"
          :class="[
            'pointer-events-auto rounded-corner border px-4 py-2 text-sm shadow-lg backdrop-blur-sm',
            notification.type === 'success'
              ? 'border-status-success bg-status-success/20 text-tx-main'
              : notification.type === 'error'
                ? 'border-status-error bg-status-error/20 text-tx-main'
                : 'border-primary bg-primary/20 text-tx-main',
          ]"
        >
          {{ notification.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
