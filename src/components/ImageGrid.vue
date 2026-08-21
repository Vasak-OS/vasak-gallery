<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import MediaCard from '@/components/ui/MediaCard.vue';
import StatePanel from '@/components/ui/StatePanel.vue';
import { useMonthLabels } from '@/composables/useMonthLabels';
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

const { t } = useI18n();
const { monthLong } = useMonthLabels();

// ─── State ────────────────────────────────────────────────────────────────────

const images = ref<MediaItemWithLoading[]>([]);
const isLoading = ref(false);
const isScanning = ref(false);
const error = ref<string | null>(null);
const mediaType = ref<FilterType>('all');
const scanProgress = ref<{ processed: number; total: number } | null>(null);
let scanUnlisteners: Array<() => void> = [];

function clearScanListeners() {
	scanUnlisteners.forEach((u) => u());
	scanUnlisteners = [];
}

// ─── Month grouping ───────────────────────────────────────────────────────────

interface MonthGroup { key: string; label: string; items: MediaItemWithLoading[] }

const groupedByMonth = computed<MonthGroup[]>(() => {
	const map = new Map<string, MonthGroup>();
	for (const item of images.value) {
		const d = new Date(item.created_at);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		if (!map.has(key)) {
			map.set(key, { key, label: `${monthLong(d.getMonth() + 1)} ${d.getFullYear()}`, items: [] });
		}
		map.get(key)?.items.push(item);
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
		error.value = err instanceof Error ? err.message : t('components.imageGrid.loadError');
	} finally {
		isLoading.value = false;
	}
}

async function scanMedia() {
	if (isScanning.value) return;
	isScanning.value = true;
	scanProgress.value = null;
	emit('scan-started');
	clearScanListeners();

	try {
		scanUnlisteners.push(
			await listen<{ total_found: number; processed: number; errors: number }>('scan_progress', (event) => {
				scanProgress.value = { processed: event.payload.processed, total: event.payload.total_found };
			})
		);
		scanUnlisteners.push(
			await listen<{ total_found: number; processed: number; errors: number }>('scan_completed', async (event) => {
				await loadImages();
				emit('scan-completed', { total: event.payload.processed, errors: event.payload.errors });
				isScanning.value = false;
				scanProgress.value = null;
				clearScanListeners();
			})
		);
		await invoke('scan_media');
	} catch (err) {
		console.error('Scan error:', err);
		isScanning.value = false;
	}
}

// ─── Labels ───────────────────────────────────────────────────────────────────

// El t() del plugin no interpola, así que los {0}/{1} se reemplazan a mano.
const scanningMessage = computed(() => {
	const progress = scanProgress.value;
	if (!progress) return t('components.imageGrid.scanning');
	return t('components.imageGrid.scanningProgress')
		.replace('{0}', String(progress.processed))
		.replace('{1}', String(progress.total));
});

const itemCountLabel = computed(() =>
	t('components.imageGrid.itemCount').replace('{0}', String(images.value.length))
);

// ─── Actions ──────────────────────────────────────────────────────────────────

function filterByType(type: string) {
	mediaType.value = type as FilterType;
	loadImages(type as FilterType);
}

function scrollToMonth(key: string) {
	document.getElementById(`month-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => props.autoScan ? scanMedia() : loadImages());

onUnmounted(() => {
	clearScanListeners();
});

defineExpose({ loadImages, scanMedia, filterByType, scrollToMonth });
</script>

<template>
  <div>

    <StatePanel v-if="isLoading" type="loading" :message="t('components.imageGrid.loading')" />

    <StatePanel v-else-if="error" type="error" :message="error">
      <template #action>
        <AppButton @click="loadImages()">{{ t('common.retry') }}</AppButton>
      </template>
    </StatePanel>

    <StatePanel
      v-else-if="isScanning && images.length === 0"
      type="loading"
      :message="scanningMessage"
    />

    <StatePanel v-else-if="images.length === 0" type="empty" :message="t('components.imageGrid.empty')">
      <template #action>
        <AppButton v-if="!isScanning" variant="primary" @click="scanMedia">
          {{ t('components.imageGrid.scanNow') }}
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
        <div class="sticky top-0 z-10 flex items-center gap-3 bg-ui-bg/80 rounded-corner px-3 py-2 backdrop-blur-md">
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
        {{ itemCountLabel }}
      </p>
    </template>

  </div>
</template>
