<script setup lang="ts">
import { reactive, ref } from 'vue';
import Lightbox from '@/components/Lightbox.vue';
import ImageGrid from '@/components/ImageGrid.vue';
import type { MediaItem } from '@/types/gallery';

// ─── Lightbox state ───────────────────────────────────────────────────────────

const lightboxOpen = ref(false);
const lightboxItem = ref<MediaItem | null>(null);
/** Items cargados actualmente en el grid, para navegar en el lightbox */
const gridItems = ref<MediaItem[]>([]);

const gridRef = ref();

function handleImageClicked(payload: { item: MediaItem; items: MediaItem[] }) {
	lightboxItem.value = payload.item;
	gridItems.value = payload.items;
	lightboxOpen.value = true;
}

function handleLightboxClose() {
	lightboxOpen.value = false;
}

function handleLightboxNavigate(item: MediaItem) {
	lightboxItem.value = item;
}

// ─── Grid controls ────────────────────────────────────────────────────────────

async function handleManualScan() {
	if (gridRef.value) {
		await gridRef.value.scanMedia();
	}
}

function showOnlyImages() {
	gridRef.value?.filterByType('image');
}

function showOnlyVideos() {
	gridRef.value?.filterByType('video');
}

function showAll() {
	gridRef.value?.filterByType('all');
}

function handleScanStarted() {
	console.log('Escaneo iniciado');
}

function handleScanCompleted(payload: { total: number; errors: number }) {
	console.log(`Escaneo completado: ${payload.total} items, ${payload.errors} errores`);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden text-white">
    <header class="px-4 py-4 sm:px-6">
      <div class="mx-auto flex flex-wrap w-full justify-between lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.25em]">Vasak Gallery</p>
          <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Galeria</h1>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="rounded-corner border border-ui-border bg-ui-surface/80 px-4 py-2 text-sm font-medium transition hover:border-secondary hover:bg-primary/15" @click="handleManualScan" title="Escanear directorios del sistema">🔄 Escanear</button>
          <button class="rounded-corner border border-ui-border bg-ui-surface/80 px-4 py-2 text-sm font-medium transition hover:border-secondary hover:bg-primary/15" @click="showAll" title="Mostrar todas las imágenes y videos">📋 Todo</button>
          <button class="rounded-corner border border-ui-border bg-ui-surface/80 px-4 py-2 text-sm font-medium transition hover:border-secondary hover:bg-primary/15" @click="showOnlyImages" title="Mostrar solo imágenes">🖼️ Imágenes</button>
          <button class="rounded-corner border border-ui-border bg-ui-surface/80 px-4 py-2 text-sm font-medium transition hover:border-secondary hover:bg-primary/15" @click="showOnlyVideos" title="Mostrar solo videos">🎬 Videos</button>
        </div>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
      <div class="h-full min-h-0 overflow-hidden">
        <ImageGrid
          ref="gridRef"
          :columns="4"
          :items-per-page="40"
          :auto-scan="true"
          @image-clicked="handleImageClicked"
          @scan-started="handleScanStarted"
          @scan-completed="handleScanCompleted"
        />
      </div>
    </main>

    <Lightbox
      :is-open="lightboxOpen"
      :current-item="lightboxItem"
      :items="gridItems"
      @close="handleLightboxClose"
      @navigate="handleLightboxNavigate"
    />
  </div>
</template>
