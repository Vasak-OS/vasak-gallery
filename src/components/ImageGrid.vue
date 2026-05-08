<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { computed, onMounted, ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import MediaCard from '@/components/ui/MediaCard.vue';
import StatePanel from '@/components/ui/StatePanel.vue';
import type { FilterType, MediaItem, MediaItemWithLoading, TimelineEntry } from '@/types/gallery';

// ─── Emits & Props ────────────────────────────────────────────────────────────

const emit = defineEmits<{
	'image-clicked':    [{ item: MediaItem; items: MediaItem[] }];
	'scan-started':     [];
	'scan-completed':   [{ total: number; errors: number }];
	'timeline-updated': [entries: TimelineEntry[]];
}>();

const props = withDefaults(defineProps<{
	autoScan?: boolean;
}>(), {
	autoScan: true,
});

// ─── State ────────────────────────────────────────────────────────────────────

const images = ref<MediaItemWithLoading[]>([]);
const isLoading = ref(false);
const isScanning = ref(false);
const error = ref<string | null>(null);
const mediaType = ref<FilterType>('all');

// ─── Month grouping ───────────────────────────────────────────────────────────

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface MonthGroup { key: string; label: string; items: MediaItemWithLoading[] }

const groupedByMonth = computed<MonthGroup[]>(() => {
	const map = new Map<string, MonthGroup>();
	for (const item of images.value) {
		const d = new Date(item.created_at);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		if (!map.has(key)) {
			map.set(key, { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [] });
		}
		map.get(key)!.items.push(item);
	}
	return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
});

function emitTimeline() {
	emit('timeline-updated', groupedByMonth.value.map(g => {
		const [year, month] = g.key.split('-').map(Number);
		return { key: g.key, year, month, count: g.items.length };
	}));
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function loadImages(type: FilterType = mediaType.value) {
	isLoading.value = true;
	error.value = null;
	try {
		const result = await invoke<MediaItem[]>('get_all_media', {
			mediaType: type === 'all' ? null : type,
		});
		images.value = result.map(i => ({ ...i, isLoaded: false, isError: false }));
		emitTimeline();
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Error al cargar imágenes';
	} finally {
		isLoading.value = false;
	}
}

async function scanMedia() {
	isScanning.value = true;
	emit('scan-started');
	try {
		await invoke('scan_media');
		// Esperar a que el evento scan_completed llegue — poll simple
		await new Promise(r => setTimeout(r, 800));
		await loadImages();
		emit('scan-completed', { total: images.value.length, errors: 0 });
	} catch (err) {
		console.error('Scan error:', err);
	} finally {
		isScanning.value = false;
	}
}

function filterByType(type: string) {
	mediaType.value = type as FilterType;
	loadImages(type as FilterType);
}

function scrollToMonth(key: string) {
	document.getElementById(`month-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => props.autoScan ? scanMedia() : loadImages());

defineExpose({ loadImages, scanMedia, filterByType, scrollToMonth });
</script>

<template>
  <div>

    <StatePanel v-if="isLoading" type="loading" message="Cargando imágenes..." />

    <StatePanel v-else-if="error" type="error" :message="error">
      <template #action>
        <AppButton @click="loadImages()">Reintentar</AppButton>
      </template>
    </StatePanel>

    <StatePanel v-else-if="images.length === 0" type="empty" message="No hay imágenes o videos disponibles">
      <template #action>
        <AppButton v-if="!isScanning" variant="primary" @click="scanMedia">
          Escanear ahora
        </AppButton>
      </template>
    </StatePanel>

    <template v-else>
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
            @click="emit('image-clicked', { item, items: images })"
          />
        </div>
      </section>

      <!-- Total count -->
      <p class="px-4 py-3 text-center text-xs text-tx-muted">
        {{ images.length }} elementos
      </p>
    </template>

  </div>
</template>
