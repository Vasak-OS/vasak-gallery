<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { ref } from 'vue';
import type { MediaItem } from '@/types/gallery';

const props = defineProps<{ item: MediaItem }>();
const emit = defineEmits<{ click: [item: MediaItem] }>();

const isLoaded = ref(false);
const isError = ref(false);
</script>

<template>
  <button
    type="button"
    class="group cursor-pointer rounded-corner p-2 text-left transition-transform duration-200 hover:-translate-y-1"
    @click="emit('click', item)"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-square overflow-hidden rounded-corner border border-ui-border bg-ui-surface/80 shadow-lg shadow-black/10">
      <img
        :src="convertFileSrc(item.thumbnail_path)"
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
        <span class="rounded-full bg-ui-bg/80 px-3 py-1 text-lg backdrop-blur-sm">
          {{ item.media_type === 'video' ? '🎬' : '🖼️' }}
        </span>
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
