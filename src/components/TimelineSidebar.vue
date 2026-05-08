<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TimelineEntry } from '@/types/gallery';

const props = defineProps<{
	entries: TimelineEntry[];
	activeKey: string | null;
}>();

const emit = defineEmits<{ jump: [key: string] }>();

const isHovered = ref(false);

interface YearGroup { year: number; months: TimelineEntry[] }

const grouped = computed<YearGroup[]>(() => {
	const map = new Map<number, YearGroup>();
	for (const e of props.entries) {
		if (!map.has(e.year)) map.set(e.year, { year: e.year, months: [] });
		map.get(e.year)!.months.push(e);
	}
	return Array.from(map.values()).sort((a, b) => b.year - a.year);
});

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
</script>

<template>
  <!--
    El aside NO tiene overflow — así los tooltips pueden salir hacia la izquierda.
    El scroll interno lo maneja el div interior.
  -->
  <aside
    class="relative flex shrink-0 flex-col border-l border-ui-border bg-ui-bg/60 backdrop-blur-sm transition-[width] duration-200"
    :class="isHovered ? 'w-28' : 'w-7'"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Línea vertical -->
    <div class="pointer-events-none absolute right-3 top-0 h-full w-px bg-ui-border" />

    <!-- Contenido scrolleable -->
    <div class="flex flex-col overflow-y-auto py-3">
      <template v-for="group in grouped" :key="group.year">

        <!-- Año -->
        <div class="relative mb-1 flex w-full items-center justify-end pr-6">
          <div class="absolute right-[9px] h-2 w-2 rounded-full border-2 border-primary bg-ui-bg" />
          <span
            class="mr-8 whitespace-nowrap text-xs font-bold text-tx-main transition-opacity duration-150"
            :class="isHovered ? 'opacity-100' : 'opacity-0'"
          >
            {{ group.year }}
          </span>
        </div>

        <!-- Meses -->
        <div
          v-for="entry in group.months"
          :key="entry.key"
          class="group/month relative flex w-full cursor-pointer items-center justify-end py-[3px] pr-6 transition-colors hover:bg-ui-surface/40"
          @click="emit('jump', entry.key)"
        >
          <!-- Tick -->
          <div
            class="absolute right-[10px] h-1.5 w-1.5 rounded-full transition-all duration-150"
            :class="activeKey === entry.key
              ? 'scale-125 bg-primary'
              : 'bg-ui-border group-hover/month:bg-tx-muted'"
          />

          <!-- Label expandido -->
          <span
            class="mr-8 whitespace-nowrap text-xs transition-opacity duration-150"
            :class="[
              isHovered ? 'opacity-100' : 'opacity-0',
              activeKey === entry.key ? 'font-semibold text-primary' : 'text-tx-muted',
            ]"
          >
            {{ MONTH_SHORT[entry.month - 1] }}
            <span class="opacity-50">{{ entry.count }}</span>
          </span>

          <!-- Tooltip colapsado: sale a la izquierda, centrado en el tick -->
          <Transition name="tooltip">
            <div
              v-if="!isHovered"
              class="pointer-events-none absolute right-full top-1/2 z-100 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-corner border border-ui-border bg-ui-bg px-2 py-1 text-xs text-tx-main shadow-lg group-hover/month:block"
            >
              {{ MONTH_SHORT[entry.month - 1] }} {{ entry.year }}
              <span class="ml-1 opacity-50">{{ entry.count }}</span>
              <!-- Flecha apuntando a la derecha -->
              <span class="absolute right-[-5px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-ui-border" />
              <span class="absolute right-[-4px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-ui-bg" />
            </div>
          </Transition>
        </div>

      </template>
    </div>
  </aside>
</template>

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.1s ease;
}
.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
