<script setup lang="ts">
import { ref } from 'vue';
import Lightbox from '@/components/Lightbox.vue';
import ImageGrid from '@/components/ImageGrid.vue';
import type { LightboxState, MediaItem } from '@/types/gallery';

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const lightbox = ref<LightboxState>({
	isOpen: false,
	currentItem: null,
	items: [],
});

const gridRef = ref();

function handleImageClicked(payload: { item: MediaItem; items: MediaItem[] }) {
	lightbox.value.currentItem = payload.item;
	lightbox.value.items = payload.items;
	lightbox.value.isOpen = true;
}

function handleLightboxClose() {
	lightbox.value.isOpen = false;
}

function handleLightboxNavigate(item: MediaItem) {
	lightbox.value.currentItem = item;
}

// ─── Grid controls ────────────────────────────────────────────────────────────

async function handleManualScan() {
	await gridRef.value?.scanMedia();
}

function showOnlyImages() { gridRef.value?.filterByType('image'); }
function showOnlyVideos() { gridRef.value?.filterByType('video'); }
function showAll() { gridRef.value?.filterByType('all'); }

function handleScanStarted() {
	console.log('Escaneo iniciado');
}

function handleScanCompleted(payload: { total: number; errors: number }) {
	console.log(`Escaneo completado: ${payload.total} items, ${payload.errors} errores`);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col text-white">
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

    <main class="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
      <ImageGrid
        ref="gridRef"
        :auto-scan="true"
        @image-clicked="handleImageClicked"
        @scan-started="handleScanStarted"
        @scan-completed="handleScanCompleted"
      />
    </main>

    <Lightbox
      :is-open="lightbox.isOpen"
      :current-item="lightbox.currentItem"
      :items="lightbox.items"
      @close="handleLightboxClose"
      @navigate="handleLightboxNavigate"
    />
  </div>
</template>
