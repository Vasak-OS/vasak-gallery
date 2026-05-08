<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { computed, onMounted, reactive } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import MediaCard from '@/components/ui/MediaCard.vue';
import StatePanel from '@/components/ui/StatePanel.vue';
import type { FilterType, GridState, MediaItem, MediaItemWithLoading, PaginatedResult, TimelineEntry } from '@/types/gallery';

// ─── Emits & Props ────────────────────────────────────────────────────────────

const emit = defineEmits<{
	'image-clicked':    [{ item: MediaItem; items: MediaItem[] }];
	'scan-started':     [];
	'scan-completed':   [{ total: number; errors: number }];
	'timeline-updated': [entries: TimelineEntry[]];
}>();

const props = withDefaults(defineProps<{
	itemsPerPage?: number;
	autoScan?: boolean;
}>(), {
	itemsPerPage: 40,
	autoScan: true,
});

// ─── State ────────────────────────────────────────────────────────────────────

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

// ─── Month grouping ───────────────────────────────────────────────────────────

interface MonthGroup {
	key: string;   // "YYYY-MM"
	label: string; // "Marzo 2024"
	items: MediaItemWithLoading[];
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const groupedByMonth = computed<MonthGroup[]>(() => {
	const map = new Map<string, MonthGroup>();
	for (const item of state.images) {
		const d = new Date(item.created_at);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		if (!map.has(key)) {
			map.set(key, { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [] });
		}
		map.get(key)!.items.push(item);
	}
	return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
});

// ─── Data ─────────────────────────────────────────────────────────────────────

async function loadImages(page = 1, mediaType = 'all') {
	state.isLoading = true;
	state.error = null;
	try {
		const result = (await invoke<PaginatedResult>(
			mediaType === 'all' ? 'get_thumbnails' : 'get_thumbnails_by_type',
			mediaType === 'all'
				? { page, perPage: props.itemsPerPage }
				: { mediaType, page, perPage: props.itemsPerPage }
		));
		state.images = result.items.map(i => ({ ...i, isLoaded: false, isError: false }));
		state.totalItems = result.total;
		state.currentPage = page;
		emit('timeline-updated', groupedByMonth.value.map(g => {
			const [year, month] = g.key.split('-').map(Number);
			return { key: g.key, year, month, count: g.items.length };
		}));
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Error al cargar imágenes';
	} finally {
		state.isLoading = false;
	}
}

async function scanMedia() {
	state.isScanning = true;
	emit('scan-started');
	try {
		await invoke('scan_media');
		await new Promise(r => setTimeout(r, 500));
		await loadImages(1, state.mediaType);
		emit('scan-completed', { total: state.totalItems, errors: 0 });
	} catch (err) {
		console.error('Scan error:', err);
	} finally {
		state.isScanning = false;
	}
}

function filterByType(mediaType: string) {
	state.mediaType = mediaType as FilterType;
	loadImages(1, mediaType);
}

function loadMore() {
	if (state.currentPage < totalPages.value) {
		loadImages(state.currentPage + 1, state.mediaType);
	}
}

function scrollToMonth(key: string) {
	document.getElementById(`month-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => props.autoScan ? scanMedia() : loadImages());

defineExpose({ loadImages, scanMedia, filterByType, loadMore, scrollToMonth });
</script>

<template>
  <div>

    <StatePanel v-if="state.isLoading" type="loading" message="Cargando imágenes..." />

    <StatePanel v-else-if="state.error" type="error" :message="state.error">
      <template #action>
        <AppButton @click="loadImages(1, state.mediaType)">Reintentar</AppButton>
      </template>
    </StatePanel>

    <StatePanel v-else-if="state.images.length === 0" type="empty" message="No hay imágenes o videos disponibles">
      <template #action>
        <AppButton v-if="!state.isScanning" variant="primary" @click="scanMedia">
          Escanear ahora
        </AppButton>
      </template>
    </StatePanel>

    <template v-else>
      <!-- Month sections -->
      <section
        v-for="group in groupedByMonth"
        :key="group.key"
        :id="`month-${group.key}`"
        class="scroll-mt-2"
      >
        <!-- Month header -->
        <div class="sticky top-0 z-10 flex items-center gap-3 bg-ui-bg/90 px-3 py-2 backdrop-blur-md">
          <span class="h-px flex-1 bg-ui-border" />
          <h2 class="text-xs font-semibold uppercase tracking-widest text-tx-muted">{{ group.label }}</h2>
          <span class="rounded-full border border-ui-border bg-ui-surface px-2 py-0.5 text-xs text-tx-muted">
            {{ group.items.length }}
          </span>
          <span class="h-px flex-1 bg-ui-border" />
        </div>

        <!-- Grid -->
        <div class="grid gap-2 p-2 sm:p-3" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
          <MediaCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            @click="emit('image-clicked', { item, items: state.images })"
          />
        </div>
      </section>

      <!-- Pagination -->
      <div class="m-3 flex items-center justify-center gap-4 rounded-corner border border-ui-border bg-ui-surface/50 px-4 py-3 text-sm">
        <p class="text-tx-muted">
          Página {{ state.currentPage }} / {{ totalPages }}
          <span class="opacity-50">· {{ state.totalItems }} elementos</span>
        </p>
        <AppButton
          v-if="state.currentPage < totalPages"
          variant="primary"
          :disabled="state.isLoading"
          @click="loadMore"
        >
          Cargar más
        </AppButton>
      </div>
    </template>

  </div>
</template>
