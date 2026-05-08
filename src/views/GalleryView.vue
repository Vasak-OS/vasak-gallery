<script setup lang="ts">
import { ref } from 'vue';
import ImageGrid from '@/components/ImageGrid.vue';
import Lightbox from '@/components/Lightbox.vue';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { LightboxState, MediaItem, TimelineEntry } from '@/types/gallery';

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const lightbox = ref<LightboxState>({
	isOpen: false,
	currentItem: null,
	items: [],
});

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

// ─── Timeline ─────────────────────────────────────────────────────────────────

const timelineEntries = ref<TimelineEntry[]>([]);
const activeTimelineKey = ref<string | null>(null);

function handleTimelineUpdated(entries: TimelineEntry[]) {
	timelineEntries.value = entries;
	activeTimelineKey.value = entries[0]?.key ?? null;
}

function handleTimelineJump(key: string) {
	activeTimelineKey.value = key;
	gridRef.value?.scrollToMonth(key, scrollRef.value);
}

// ─── Grid controls ────────────────────────────────────────────────────────────

const gridRef = ref();
const scrollRef = ref<HTMLElement | null>(null);

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
  <div class="gallery-view">

    <!-- ── Header ── -->
    <header class="gallery-header shrink-0 px-4 py-3 sm:px-6">
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-tx-muted">Vasak Gallery</p>
          <h1 class="text-2xl font-semibold tracking-tight text-tx-main sm:text-3xl">Galería</h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-corner border border-ui-border bg-ui-surface/80 px-3 py-1.5 text-sm font-medium transition hover:border-secondary hover:bg-primary/15"
            title="Escanear directorios del sistema"
            @click="handleManualScan"
          >🔄 Escanear</button>
          <button
            class="rounded-corner border border-ui-border bg-ui-surface/80 px-3 py-1.5 text-sm font-medium transition hover:border-secondary hover:bg-primary/15"
            @click="showAll"
          >📋 Todo</button>
          <button
            class="rounded-corner border border-ui-border bg-ui-surface/80 px-3 py-1.5 text-sm font-medium transition hover:border-secondary hover:bg-primary/15"
            @click="showOnlyImages"
          >🖼️ Imágenes</button>
          <button
            class="rounded-corner border border-ui-border bg-ui-surface/80 px-3 py-1.5 text-sm font-medium transition hover:border-secondary hover:bg-primary/15"
            @click="showOnlyVideos"
          >🎬 Videos</button>
        </div>
      </div>
    </header>

    <!-- ── Body: sidebar + grid ── -->
    <div class="gallery-body flex overflow-hidden">

      <TimelineSidebar
        :entries="timelineEntries"
        :active-key="activeTimelineKey"
        @jump="handleTimelineJump"
      />

      <main ref="scrollRef" class="flex-1 overflow-y-auto">
        <ImageGrid
          ref="gridRef"
          :auto-scan="true"
          @image-clicked="handleImageClicked"
          @scan-started="handleScanStarted"
          @scan-completed="handleScanCompleted"
          @timeline-updated="handleTimelineUpdated"
        />
      </main>

    </div>

    <Lightbox
      :is-open="lightbox.isOpen"
      :current-item="lightbox.currentItem"
      :items="lightbox.items"
      @close="handleLightboxClose"
      @navigate="handleLightboxNavigate"
    />
  </div>
</template>

<style scoped>
.gallery-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.gallery-header {
  flex-shrink: 0;
}

.gallery-body {
  /* Ocupa todo el espacio restante después del header */
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
</style>
