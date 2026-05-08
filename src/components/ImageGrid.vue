<script setup lang="ts">
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { FilterType, GridState, MediaItem, PaginatedResult } from '@/types/gallery';

const emit = defineEmits<{
	'image-clicked': [{ originalPath: string; mediaType: 'image' | 'video' }];
	'scan-started': [];
	'scan-completed': [{ total: number; errors: number }];
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
const visibleItems = computed(() =>
	state.images.map((item, index) => ({
		...item,
		index,
	}))
);

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
				mediaType: mediaType,
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

function setupLazyLoading() {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach(async (entry) => {
				if (!entry.isIntersecting) {
					return;
				}

				const img = entry.target as HTMLImageElement;
				const src = img.dataset.src;
				const itemPath = img.dataset.path;

				if (!src || !itemPath) {
					return;
				}

				try {
					// Usar el comando get_thumbnail_data para obtener la imagen de forma segura
					const dataUrl = (await invoke('get_thumbnail_data', { path: src })) as string;
					img.src = dataUrl;
					img.onload = () => {
						const item = state.images.find((current) => current.thumbnail_path === itemPath);
						if (item) {
							item.isLoaded = true;
						}
					};
				} catch (err) {
					console.error('Error loading thumbnail:', err);
					const item = state.images.find((current) => current.thumbnail_path === itemPath);
					if (item) {
						item.isError = true;
					}
				}

				observer.unobserve(img);
			});
		},
		{
			rootMargin: '50px',
			threshold: 0,
		}
	);

	return observer;
}

let lazyObserver: IntersectionObserver | null = null;

function registerLazyImages() {
	const images = document.querySelectorAll('img[data-src]');
	images.forEach((img) => {
		if (lazyObserver) {
			lazyObserver.observe(img);
		}
	});
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
		originalPath: item.original_path,
		mediaType: item.media_type,
	});
}

function loadMore() {
	if (state.currentPage < totalPages.value) {
		goToPage(state.currentPage + 1);
	}
}

onMounted(async () => {
	lazyObserver = setupLazyLoading();

	if (props.autoScan) {
		await scanMedia();
	} else {
		await loadImages(1, state.mediaType);
	}
});

onUnmounted(() => {
	lazyObserver?.disconnect();
});

watch(
	() => state.images,
	() => {
		setTimeout(registerLazyImages, 0);
	},
	{ deep: true }
);

defineExpose({
	loadImages,
	scanMedia,
	filterByType,
	goToPage,
	loadMore,
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-4 py-4 backdrop-blur-md">
      <div class="flex flex-wrap gap-2">
        <button
          :class="[
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200',
            state.mediaType === 'all'
              ? 'border-white bg-white/20 text-white shadow-lg shadow-black/20'
              : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10',
          ]"
          @click="filterByType('all')"
          :disabled="state.isScanning"
        >
          Todo
        </button>
        <button
          :class="[
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200',
            state.mediaType === 'image'
              ? 'border-white bg-white/20 text-white shadow-lg shadow-black/20'
              : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10',
          ]"
          @click="filterByType('image')"
          :disabled="state.isScanning"
        >
          Imágenes
        </button>
        <button
          :class="[
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200',
            state.mediaType === 'video'
              ? 'border-white bg-white/20 text-white shadow-lg shadow-black/20'
              : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10',
          ]"
          @click="filterByType('video')"
          :disabled="state.isScanning"
        >
          Videos
        </button>
      </div>

      <button
        class="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition-all duration-200 hover:border-cyan-300 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
        @click="scanMedia"
        :disabled="state.isScanning"
      >
        {{ state.isScanning ? 'Escaneando...' : 'Escanear' }}
      </button>
    </div>

    <div v-if="state.isLoading" class="flex min-h-0 flex-1 items-center justify-center gap-4 p-8">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <p class="text-sm text-white/80">Cargando imágenes...</p>
    </div>

    <div v-else-if="state.error" class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p class="text-sm text-red-200">Error: {{ state.error }}</p>
      <button
        class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        @click="loadImages(1, state.mediaType)"
      >
        Reintentar
      </button>
    </div>

    <div
      v-else-if="state.images.length === 0"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p class="text-sm text-white/75">No hay imágenes o videos disponibles</p>
      <button
        v-if="!state.isScanning"
        class="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-300/20"
        @click="scanMedia"
      >
        Escanear ahora
      </button>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <RecycleScroller
        key-field="id"
        :items="visibleItems"
        :item-size="250"
        type="grid"
        class="min-h-0 flex-1 overflow-auto"
        :grid-items="props.columns"
        :buffer="10"
      >
        <template #default="{ item }">
          <div class="group cursor-pointer p-2 transition-transform duration-200 hover:-translate-y-1" @click="handleImageClick(item)">
            <div class="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/10">
              <img
                :data-src="item.thumbnail_path"
                :data-path="item.thumbnail_path"
                :alt="item.original_path"
                class="h-full w-full object-cover transition-opacity duration-300"
                :class="item.isLoaded ? 'opacity-100' : 'opacity-0'"
                loading="lazy"
              />

              <div
                class="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 via-black/0 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                <div class="rounded-full bg-black/35 px-3 py-1 text-lg backdrop-blur-sm">
                  {{ item.media_type === 'video' ? '🎬' : '🖼️' }}
                </div>
              </div>

              <div v-if="item.isError" class="absolute inset-0 flex items-center justify-center bg-black/40">
                <span class="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-white/80">Error al cargar</span>
              </div>

              <div v-if="!item.isLoaded && !item.isError" class="absolute inset-0 animate-pulse bg-white/10" />
            </div>

            <div class="mt-2 min-w-0 space-y-1 px-1">
              <p class="truncate text-sm font-medium text-white">
                {{ item.original_path.split('/').pop() }}
              </p>
              <p class="text-xs text-white/60">
                {{ new Date(item.created_at).toLocaleDateString() }}
              </p>
            </div>
          </div>
        </template>
      </RecycleScroller>

      <div class="flex items-center justify-center gap-4 border-t border-white/10 bg-black/20 px-4 py-4 text-sm text-white/80 backdrop-blur-md">
        <p>
          Página {{ state.currentPage }} de {{ totalPages }}
          ({{ state.totalItems }} total)
        </p>
        <button
          v-if="state.currentPage < totalPages"
          class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          @click="loadMore"
          :disabled="state.isLoading"
        >
          Cargar más
        </button>
      </div>
    </div>
  </div>
</template>
