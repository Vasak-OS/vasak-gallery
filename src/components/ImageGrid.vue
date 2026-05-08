<script setup lang="ts">
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { computed, onMounted, reactive } from 'vue';
import type { FilterType, GridState, MediaItem, MediaItemWithLoading, PaginatedResult, TimelineEntry } from '@/types/gallery';

const emit = defineEmits<{
	'image-clicked': [{ item: MediaItem; items: MediaItem[] }];
	'scan-started': [];
	'scan-completed': [{ total: number; errors: number }];
	'timeline-updated': [entries: TimelineEntry[]];
}>();

const props = withDefaults(
	defineProps<{
		columns?: number;
		itemsPerPage?: number;
		autoScan?: boolean;
	}>(),
	{
		columns: 4,
		itemsPerPage: 40,
		autoScan: true,
	}
);

const state = reactive<GridState>({
	images: [],
	isLoading: false,
	isScanning: false,
	currentPage: 1,
	totalItems: 0,
	error: null,
	mediaType: 'all',
});

const totalPages = computed(() => Math.max(1, Math.ceil(state.totalItems / props.itemsPerPage)));

// ─── Timeline grouping ────────────────────────────────────────────────────────

interface MonthGroup {
	key: string;       // "YYYY-MM"
	label: string;     // "Marzo 2024"
	items: MediaItemWithLoading[];
}

const MONTH_NAMES_FULL = [
	'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
	'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const groupedByMonth = computed<MonthGroup[]>(() => {
	const map = new Map<string, MonthGroup>();

	for (const item of state.images) {
		const date = new Date(item.created_at);
		const year = date.getFullYear();
		const month = date.getMonth(); // 0-indexed
		const key = `${year}-${String(month + 1).padStart(2, '0')}`;

		if (!map.has(key)) {
			map.set(key, {
				key,
				label: `${MONTH_NAMES_FULL[month]} ${year}`,
				items: [],
			});
		}
		map.get(key)!.items.push(item);
	}

	// Sort descending (newest first)
	return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
});

function buildTimelineEntries(): TimelineEntry[] {
	return groupedByMonth.value.map((g) => {
		const [year, month] = g.key.split('-').map(Number);
		return { key: g.key, year, month, count: g.items.length };
	});
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadImages(page: number = 1, mediaType: string = 'all') {
	try {
		state.isLoading = true;
		state.error = null;

		let result: PaginatedResult;

		if (mediaType === 'all') {
			result = (await invoke('get_thumbnails', {
				page,
				perPage: props.itemsPerPage,
			})) as PaginatedResult;
		} else {
			result = (await invoke('get_thumbnails_by_type', {
				mediaType,
				page,
				perPage: props.itemsPerPage,
			})) as PaginatedResult;
		}

		state.images = result.items.map((item) => ({
			...item,
			isLoaded: false,
			isError: false,
		}));

		state.totalItems = result.total;
		state.currentPage = page;

		// Notify parent of timeline data
		emit('timeline-updated', buildTimelineEntries());
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Error loading images';
		console.error('Error loading images:', err);
	} finally {
		state.isLoading = false;
	}
}

async function scanMedia() {
	try {
		state.isScanning = true;
		emit('scan-started');
		await invoke('scan_media');
		await new Promise((resolve) => setTimeout(resolve, 500));
		await loadImages(1, state.mediaType);
		emit('scan-completed', { total: state.totalItems, errors: 0 });
	} catch (err) {
		console.error('Error during scan:', err);
	} finally {
		state.isScanning = false;
	}
}

function goToPage(page: number) {
	loadImages(page, state.mediaType);
}

function filterByType(mediaType: string) {
	state.mediaType = mediaType as FilterType;
	goToPage(1);
}

function handleImageClick(item: MediaItem) {
	emit('image-clicked', {
		item,
		items: state.images,
	});
}

function loadMore() {
	if (state.currentPage < totalPages.value) {
		goToPage(state.currentPage + 1);
	}
}

/** Scroll the grid to a specific month anchor */
function scrollToMonth(key: string, container?: HTMLElement | null) {
	const el = document.getElementById(`month-${key}`);
	if (!el) return;
	if (container) {
		// Scroll within the specific container
		const top = el.offsetTop - (container.offsetTop ?? 0);
		container.scrollTo({ top, behavior: 'smooth' });
	} else {
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}

onMounted(async () => {
	if (props.autoScan) {
		await scanMedia();
	} else {
		await loadImages(1, state.mediaType);
	}
});

defineExpose({
	loadImages,
	scanMedia,
	filterByType,
	goToPage,
	loadMore,
	scrollToMonth,
});
</script>

<template>
  <div class="flex flex-col">

    <!-- Loading -->
    <div v-if="state.isLoading" class="flex min-h-64 items-center justify-center gap-4 p-8">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-ui-border border-t-primary" />
      <p class="text-sm text-tx-muted">Cargando imágenes...</p>
    </div>

    <!-- Error -->
    <div v-else-if="state.error" class="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
      <p class="text-sm text-status-error">Error: {{ state.error }}</p>
      <button
        class="rounded-corner border border-ui-border bg-ui-surface px-4 py-2 text-sm font-medium text-tx-main transition hover:border-secondary hover:bg-primary/15"
        @click="loadImages(1, state.mediaType)"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="state.images.length === 0" class="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
      <p class="text-sm text-tx-muted">No hay imágenes o videos disponibles</p>
      <button
        v-if="!state.isScanning"
        class="rounded-corner border border-secondary/40 bg-secondary/10 px-4 py-2 text-sm font-semibold text-tx-main transition hover:border-secondary hover:bg-secondary/20"
        @click="scanMedia"
      >
        Escanear ahora
      </button>
    </div>

    <!-- Grid grouped by month -->
    <template v-else>
      <section
        v-for="group in groupedByMonth"
        :key="group.key"
        :id="`month-${group.key}`"
        class="scroll-mt-4"
      >
        <!-- Month header -->
        <div class="sticky top-0 z-10 flex items-center gap-3 bg-ui-bg/90 px-3 py-2 backdrop-blur-md">
          <span class="h-px flex-1 bg-ui-border" />
          <h2 class="text-xs font-semibold uppercase tracking-widest text-tx-muted">
            {{ group.label }}
          </h2>
          <span class="rounded-full border border-ui-border bg-ui-surface px-2 py-0.5 text-xs text-tx-muted">
            {{ group.items.length }}
          </span>
          <span class="h-px flex-1 bg-ui-border" />
        </div>

        <!-- Items grid -->
        <div
          class="grid gap-2 p-2 sm:p-3"
          :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }"
        >
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="group cursor-pointer rounded-corner p-2 text-left transition-transform duration-200 hover:-translate-y-1"
            @click="handleImageClick(item)"
          >
            <div class="relative aspect-square overflow-hidden rounded-corner border border-ui-border bg-ui-surface/80 shadow-lg shadow-black/10">
              <img
                :src="convertFileSrc(item.thumbnail_path)"
                :alt="item.original_path"
                class="h-full w-full object-cover transition-opacity duration-300"
                :class="item.isLoaded ? 'opacity-100' : 'opacity-0'"
                loading="lazy"
                decoding="async"
                @load="item.isLoaded = true"
                @error="item.isError = true"
              />
              <div class="absolute inset-0 flex items-end justify-end bg-linear-to-t from-ui-bg/50 via-black/0 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div class="rounded-full bg-ui-bg/80 px-3 py-1 text-lg backdrop-blur-sm">
                  {{ item.media_type === 'video' ? '🎬' : '🖼️' }}
                </div>
              </div>
              <div v-if="item.isError" class="absolute inset-0 flex items-center justify-center bg-ui-bg/60">
                <span class="rounded-full border border-ui-border bg-ui-surface px-3 py-1 text-xs text-tx-muted">Error al cargar</span>
              </div>
              <div v-if="!item.isLoaded && !item.isError" class="absolute inset-0 animate-pulse bg-ui-surface/40" />
            </div>
            <div class="mt-2 min-w-0 space-y-1 px-1">
              <p class="truncate text-sm font-medium text-tx-main">
                {{ item.original_path.split('/').pop() }}
              </p>
              <p class="text-xs text-tx-muted">
                {{ new Date(item.created_at).toLocaleDateString() }}
              </p>
            </div>
          </button>
        </div>
      </section>

      <!-- Pagination footer -->
      <div class="m-3 flex items-center justify-center gap-4 rounded-corner border border-ui-border bg-ui-surface/50 px-4 py-3 text-sm backdrop-blur-md">
        <p class="text-tx-muted">
          Página {{ state.currentPage }} de {{ totalPages }}
          <span class="text-tx-muted/50">· {{ state.totalItems }} elementos</span>
        </p>
        <button
          v-if="state.currentPage < totalPages"
          class="rounded-corner border border-secondary bg-primary/15 px-4 py-2 font-medium text-tx-main transition hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="state.isLoading"
          @click="loadMore"
        >
          Cargar más
        </button>
      </div>
    </template>

  </div>
</template>
