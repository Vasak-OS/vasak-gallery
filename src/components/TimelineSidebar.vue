<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TimelineEntry } from '@/types/gallery';

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
	entries: TimelineEntry[];
	activeKey: string | null;
}>();

const emit = defineEmits<{
	jump: [key: string];
}>();

// ─── Collapsed years ─────────────────────────────────────────────────────────

const collapsedYears = ref<Set<number>>(new Set());

function toggleYear(year: number) {
	if (collapsedYears.value.has(year)) {
		collapsedYears.value.delete(year);
	} else {
		collapsedYears.value.add(year);
	}
}

// ─── Grouped by year ─────────────────────────────────────────────────────────

interface YearGroup {
	year: number;
	total: number;
	months: TimelineEntry[];
}

const grouped = computed<YearGroup[]>(() => {
	const map = new Map<number, YearGroup>();
	for (const entry of props.entries) {
		if (!map.has(entry.year)) {
			map.set(entry.year, { year: entry.year, total: 0, months: [] });
		}
		const group = map.get(entry.year)!;
		group.months.push(entry);
		group.total += entry.count;
	}
	// Sort years descending
	return Array.from(map.values()).sort((a, b) => b.year - a.year);
});

const MONTH_NAMES = [
	'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
	'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
</script>

<template>
  <aside class="group flex w-[72px] shrink-0 flex-col overflow-hidden border-r border-ui-border bg-ui-bg/80 backdrop-blur-sm transition-[width] duration-200 hover:w-44">

    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-ui-border px-3 py-3">
      <svg class="h-4 w-4 shrink-0 text-tx-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
      <span class="hidden whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-tx-muted group-hover:block">
        Línea de tiempo
      </span>
    </div>

    <!-- Timeline entries -->
    <div class="flex-1 overflow-y-auto py-2">
      <div v-for="group in grouped" :key="group.year">

        <!-- Year row -->
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-ui-surface/60"
          @click="toggleYear(group.year)"
        >
          <svg
            class="h-3 w-3 shrink-0 text-tx-muted transition-transform"
            :class="collapsedYears.has(group.year) ? '-rotate-90' : ''"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span class="text-sm font-bold text-tx-main">{{ group.year }}</span>
          <span class="hidden whitespace-nowrap text-xs text-tx-muted group-hover:block">
            · {{ group.total }}
          </span>
        </button>

        <!-- Month rows -->
        <template v-if="!collapsedYears.has(group.year)">
          <button
            v-for="entry in group.months"
            :key="entry.key"
            class="flex w-full items-center gap-2 py-1 pl-6 pr-3 text-left transition hover:bg-ui-surface/60"
            :class="activeKey === entry.key ? 'text-primary' : 'text-tx-muted'"
            @click="emit('jump', entry.key)"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full transition"
              :class="activeKey === entry.key ? 'bg-primary' : 'bg-ui-border'"
            />
            <span class="text-xs font-medium">
              {{ MONTH_NAMES[entry.month - 1] }}
            </span>
            <span class="hidden whitespace-nowrap text-xs text-tx-muted/60 group-hover:block">
              {{ entry.count }}
            </span>
          </button>
        </template>

      </div>

      <!-- Empty state -->
      <div v-if="grouped.length === 0" class="px-3 py-4 text-center text-xs text-tx-muted">
        Sin datos
      </div>
    </div>
  </aside>
</template>
