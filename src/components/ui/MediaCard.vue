<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { computed, ref } from 'vue';
import type { MediaItem } from '@/types/gallery';

const props = defineProps<{ item: MediaItem }>();
const emit = defineEmits<{ click: [item: MediaItem] }>();

const isLoaded = ref(false);
const isError = ref(false);
const isHovered = ref(false);

// Detectar si el archivo es animado (GIF o WebP)
const ext = computed(() => props.item.original_path.split('.').pop()?.toLowerCase() ?? '');
const isAnimated = computed(() => ext.value === 'gif' || ext.value === 'webp');

// Al hacer hover en un GIF/WebP, mostrar el original en lugar del thumbnail
const imgSrc = computed(() =>
	isAnimated.value && isHovered.value
		? convertFileSrc(props.item.original_path)
		: convertFileSrc(props.item.thumbnail_path)
);

// Badge de tipo
const typeBadge = computed(() => {
	if (props.item.media_type === 'video') return '🎬';
	if (ext.value === 'gif') return 'GIF';
	if (ext.value === 'webp') return 'WebP';
	return null; // imágenes normales no muestran badge
});
</script>

<template>
  <button
    type="button"
    class="group cursor-pointer rounded-corner p-2 text-left transition-transform duration-200 hover:-translate-y-1"
    @click="emit('click', item)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-square overflow-hidden rounded-corner border border-ui-border bg-ui-surface/80 shadow-lg shadow-black/10">
      <img
        :src="imgSrc"
        :alt="item.original_path"
        class="h-full w-full object-cover transition-opacity duration-300"
        :class="isLoaded ? 'opacity-100' : 'opacity-0'"
        loading="lazy"
        decoding="async"
        @load="isLoaded = true"
        @error="isError = true"
      />

      <!-- Hover overlay -->
      <div class="absolute inset-0 flex items-end justify-end bg-linear-to-t from-ui-bg/50 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span
          v-if="typeBadge"
          class="rounded-full bg-ui-bg/80 px-3 py-1 text-sm font-semibold backdrop-blur-sm"
          :class="ext === 'gif' || ext === 'webp' ? 'text-primary' : 'text-tx-main'"
        >
          {{ typeBadge }}
        </span>
      </div>

      <!-- Indicador GIF/WebP animado (siempre visible, no solo en hover) -->
      <div
        v-if="isAnimated"
        class="absolute left-2 top-2 rounded border border-primary/40 bg-ui-bg/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-sm"
      >
        {{ ext }}
      </div>

      <!-- Error badge -->
      <div v-if="isError" class="absolute inset-0 flex items-center justify-center bg-ui-bg/60">
        <span class="rounded-full border border-ui-border bg-ui-surface px-3 py-1 text-xs text-tx-muted">
          Error al cargar
        </span>
      </div>

      <!-- Skeleton -->
      <div v-if="!isLoaded && !isError" class="absolute inset-0 animate-pulse bg-ui-surface/40" />
    </div>

    <!-- Metadata -->
    <div class="mt-2 min-w-0 space-y-0.5 px-1">
      <p class="truncate text-sm font-medium text-tx-main">
        {{ item.original_path.split('/').pop() }}
      </p>
      <p class="text-xs text-tx-muted">
        {{ new Date(item.created_at).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' }) }}
      </p>
    </div>
  </button>
</template>
