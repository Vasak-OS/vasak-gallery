<script setup lang="ts">
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { ActionButton, PageHeader } from '@vasakgroup/vue-libvasak';
import { ref } from 'vue';
import ImageGrid from '@/components/ImageGrid.vue';
import Lightbox from '@/components/Lightbox.vue';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { LightboxState, MediaItem, TimelineEntry } from '@/types/gallery';

const { t } = useI18n();

const lightbox = ref<LightboxState>({ isOpen: false, currentItem: null, items: [] });
function openLightbox(payload: { item: MediaItem; items: MediaItem[] }) {
	lightbox.value = { isOpen: true, currentItem: payload.item, items: payload.items };
}

const timelineEntries = ref<TimelineEntry[]>([]);

/**
 * La línea de tiempo abierta encima de la grilla, en una ventana angosta.
 *
 * Por debajo de 30 rem de ancho la barra no entra al lado de la grilla sin
 * comerle la única columna de fotos, así que se esconde y se abre con el botón
 * de la cabecera, como en una aplicación de teléfono. En el ancho de siempre la
 * barra va al lado, igual que antes, y este estado no se usa.
 */
const timelineOpen = ref(false);
const activeTimelineKey = ref<string | null>(null);
const gridRef = ref();

function onTimelineUpdated(entries: TimelineEntry[]) {
	timelineEntries.value = entries;
	if (!activeTimelineKey.value) activeTimelineKey.value = entries[0]?.key ?? null;
}
function onTimelineJump(key: string) {
	activeTimelineKey.value = key;
	gridRef.value?.scrollToMonth(key);
	// Elegido el mes, la barra que tapaba la grilla ya cumplió.
	timelineOpen.value = false;
}
</script>

<template>
  <div class="@container/window flex h-full w-full flex-col overflow-hidden">
    <!-- Ocupa todo el espacio que le da WindowAppLayout. Es el contenedor que
         decide si la línea de tiempo va al lado o se abre encima: el ancho de
         la ventana, no el de la pantalla. -->

    <!-- Header fijo. Los filtros siguen siendo acciones y no un selector con
         uno elegido: mostrar cuál está activo sería agregarle información a la
         pantalla (decisión 3 de vue-libvasak#74). -->
    <PageHeader
      class="shrink-0 px-4 py-3"
      size="lg"
      :eyebrow="t('views.gallery.section')"
      :title="t('views.gallery.title')">
      <template #actions>
        <ActionButton variant="secondary" icon="view-refresh" :label="t('views.gallery.scan')" @click="gridRef?.scanMedia()" />
        <ActionButton variant="secondary" icon="view-grid" :label="t('views.gallery.filterAll')" @click="gridRef?.filterByType('all')" />
        <ActionButton variant="secondary" icon="image-x-generic" :label="t('views.gallery.filterImages')" @click="gridRef?.filterByType('image')" />
        <ActionButton variant="secondary" icon="video-x-generic" :label="t('views.gallery.filterVideos')" @click="gridRef?.filterByType('video')" />
        <ActionButton
          class="@min-[30rem]/window:hidden"
          variant="secondary"
          icon="x-office-calendar"
          :label="t('views.gallery.timeline')"
          :pressed="timelineOpen"
          data-timeline-toggle
          @click="timelineOpen = !timelineOpen"
        />
      </template>
    </PageHeader>

    <!-- Cuerpo: área scrolleable + sidebar derecho -->
    <div class="relative flex min-h-0 flex-1">
      <!-- Este es el único scroll container -->
      <main class="min-w-0 flex-1 overflow-y-auto">
        <ImageGrid
          ref="gridRef"
          :auto-scan="true"
          @image-clicked="openLightbox"
          @timeline-updated="onTimelineUpdated"
        />
      </main>
      <!-- Al lado de la grilla, en el ancho de siempre. -->
      <div class="hidden min-h-0 @min-[30rem]/window:flex" data-timeline-docked>
        <TimelineSidebar
          :entries="timelineEntries"
          :active-key="activeTimelineKey"
          @jump="onTimelineJump"
        />
      </div>
      <!-- Encima de la grilla, en una ventana angosta y sólo si se pidió. -->
      <div
        v-if="timelineOpen"
        class="absolute inset-y-0 right-0 z-20 flex shadow-surface-l @min-[30rem]/window:hidden"
        data-timeline-overlay
      >
        <TimelineSidebar
          :entries="timelineEntries"
          :active-key="activeTimelineKey"
          always-expanded
          @jump="onTimelineJump"
        />
      </div>
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
