<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import ImageGrid from '@/components/ImageGrid.vue';
import Lightbox from '@/components/Lightbox.vue';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { LightboxState, MediaItem, TimelineEntry } from '@/types/gallery';

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const lightbox = ref<LightboxState>({ isOpen: false, currentItem: null, items: [] });

function openLightbox(payload: { item: MediaItem; items: MediaItem[] }) {
	lightbox.value = { isOpen: true, currentItem: payload.item, items: payload.items };
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

const timelineEntries = ref<TimelineEntry[]>([]);
const activeTimelineKey = ref<string | null>(null);
const gridRef = ref();

function onTimelineUpdated(entries: TimelineEntry[]) {
	timelineEntries.value = entries;
	if (!activeTimelineKey.value) activeTimelineKey.value = entries[0]?.key ?? null;
}

function onTimelineJump(key: string) {
	activeTimelineKey.value = key;
	gridRef.value?.scrollToMonth(key);
}
</script>

<template>
  <div class="layout">

    <!-- Header -->
    <header class="layout-header border-b border-ui-border px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-tx-muted">Vasak Gallery</p>
          <h1 class="text-2xl font-semibold text-tx-main">Galería</h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton size="sm" @click="gridRef?.scanMedia()">🔄 Escanear</AppButton>
          <AppButton size="sm" @click="gridRef?.filterByType('all')">📋 Todo</AppButton>
          <AppButton size="sm" @click="gridRef?.filterByType('image')">🖼️ Imágenes</AppButton>
          <AppButton size="sm" @click="gridRef?.filterByType('video')">🎬 Videos</AppButton>
        </div>
      </div>
    </header>

    <!-- Body -->
    <div class="layout-body">
      <TimelineSidebar
        :entries="timelineEntries"
        :active-key="activeTimelineKey"
        @jump="onTimelineJump"
      />
      <main class="layout-scroll">
        <ImageGrid
          ref="gridRef"
          :auto-scan="true"
          @image-clicked="openLightbox"
          @timeline-updated="onTimelineUpdated"
        />
      </main>
    </div>

    <Lightbox
      :is-open="lightbox.isOpen"
      :current-item="lightbox.currentItem"
      :items="lightbox.items"
      @close="lightbox.isOpen = false"
      @navigate="lightbox.currentItem = $event"
    />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.layout-header {
  flex: 0 0 auto;
}

.layout-body {
  flex: 1 1 0;
  min-height: 0;          /* crítico: permite que el flex item se encoja */
  display: flex;
  overflow: hidden;
}

.layout-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;       /* único scroll container */
  overflow-x: hidden;
}
</style>
