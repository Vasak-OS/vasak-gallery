<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import ImageGrid from '@/components/ImageGrid.vue';
import Lightbox from '@/components/Lightbox.vue';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { LightboxState, MediaItem, TimelineEntry } from '@/types/gallery';

const lightbox = ref<LightboxState>({ isOpen: false, currentItem: null, items: [] });
function openLightbox(payload: { item: MediaItem; items: MediaItem[] }) {
	lightbox.value = { isOpen: true, currentItem: payload.item, items: payload.items };
}

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
  <!-- Ocupa todo el espacio que le da WindowAppLayout -->
  <div class="flex h-full w-full flex-col overflow-hidden">

    <!-- Header fijo -->
    <header class="shrink-0 border-b border-ui-border px-4 py-3">
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

    <!-- Cuerpo: sidebar + área scrolleable -->
    <div class="flex min-h-0 flex-1">
      <TimelineSidebar
        :entries="timelineEntries"
        :active-key="activeTimelineKey"
        @jump="onTimelineJump"
      />
      <!-- Este es el único scroll container -->
      <main class="flex-1 overflow-y-auto">
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
