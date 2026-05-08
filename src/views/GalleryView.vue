<script setup lang="ts">
import { reactive, ref } from 'vue';
import FullscreenViewer from '@/components/FullscreenViewer.vue';
import ImageGrid from '@/components/ImageGrid.vue';
import type { FullscreenViewerState } from '@/types/gallery';

const viewerState = reactive<FullscreenViewerState>({
	isOpen: false,
	originalPath: '',
	mediaType: 'image',
});

const gridRef = ref();

function handleImageClicked(payload: { originalPath: string; mediaType: 'image' | 'video' }) {
	viewerState.originalPath = payload.originalPath;
	viewerState.mediaType = payload.mediaType;
	viewerState.isOpen = true;
}

function handleViewerClose() {
	viewerState.isOpen = false;
}

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
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-white">
    <header class="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-4 shadow-lg shadow-black/20 backdrop-blur-md sm:px-6">
      <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Vasak Gallery</p>
          <h1 class="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Galería de imágenes</h1>
          <p class="text-sm text-white/60">Explora miniaturas indexadas con carga diferida y vista completa.</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/15" @click="handleManualScan" title="Escanear directorios del sistema">🔄 Escanear</button>
          <button class="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/15" @click="showAll" title="Mostrar todas las imágenes y videos">📋 Todo</button>
          <button class="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/15" @click="showOnlyImages" title="Mostrar solo imágenes">🖼️ Imágenes</button>
          <button class="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/15" @click="showOnlyVideos" title="Mostrar solo videos">🎬 Videos</button>
        </div>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
      <div class="h-full min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/20">
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

    <FullscreenViewer
      :is-open="viewerState.isOpen"
      :original-path="viewerState.originalPath"
      :media-type="viewerState.mediaType"
      @close="handleViewerClose"
    />
  </div>
</template>
