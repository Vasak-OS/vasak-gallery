<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { Badge, Skeleton, ThemeIcon } from '@vasakgroup/vue-libvasak';
import { computed, ref } from 'vue';
import type { MediaItem } from '@/types/gallery';

const props = defineProps<{ item: MediaItem }>();
const emit = defineEmits<{ click: [item: MediaItem] }>();

const { t, locale } = useI18n();

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

// La fecha se formatea con el idioma activo, no con uno fijo
const formattedDate = computed(() =>
	new Date(props.item.created_at).toLocaleDateString(locale.value, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
);

/**
 * La insignia de tipo, al pasar el ratón.
 *
 * El vídeo era un 🎬 escrito, que se dibuja con la fuente de emojis y no con el
 * tema: ahora es el icono `video-x-generic`. Las imágenes comunes no llevan.
 */
const typeBadge = computed<{ icon: string } | { text: string } | null>(() => {
	if (props.item.media_type === 'video') return { icon: 'video-x-generic' };
	if (ext.value === 'gif') return { text: 'GIF' };
	if (ext.value === 'webp') return { text: 'WebP' };
	return null;
});
</script>

<template>
  <button
    type="button"
    :data-media-id="item.id"
    class="group cursor-pointer rounded-corner-m p-2 text-left"
    @click="emit('click', item)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- La tarjeta se marca sola con el id del elemento que muestra. La rejilla
         lo busca con `closest('[data-media-id]')` para saber sobre cuál se hizo
         clic derecho; antes se lo pasaba desde afuera y llegaba acá por caída de
         atributos, que es algo que no estaba escrito en ningún lado. -->
    <!-- Thumbnail. Ya no sube al pasar el ratón: en Once UI lo que reacciona
         es el velo, no la posición. -->
    <div class="relative aspect-square overflow-hidden rounded-corner-m border border-ui-line bg-ui-surface/80 shadow-surface-s">
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
        <Badge v-if="typeBadge" variant="overlay" size="md">
          <ThemeIcon
            v-if="'icon' in typeBadge"
            :name="typeBadge.icon"
            type="symbol"
            :size="16"
            :alt="t('components.mediaCard.video')"
          />
          <template v-else>{{ typeBadge.text }}</template>
        </Badge>
      </div>

      <!-- Indicador GIF/WebP animado (siempre visible, no solo en hover) -->
      <Badge v-if="isAnimated" variant="overlay" class="absolute left-2 top-2 uppercase">
        {{ ext }}
      </Badge>

      <!-- Error badge -->
      <div v-if="isError" class="absolute inset-0 flex items-center justify-center bg-ui-bg/60">
        <Badge>{{ t('components.mediaCard.loadError') }}</Badge>
      </div>

      <!-- Skeleton -->
      <Skeleton v-if="!isLoaded && !isError" shape="block" width="100%" height="100%" class="absolute inset-0" />
    </div>

    <!-- Metadata -->
    <div class="mt-2 min-w-0 space-y-0.5 px-1">
      <p class="truncate text-sm font-medium text-tx-main">
        {{ item.original_path.split('/').pop() }}
      </p>
      <p class="text-xs text-tx-muted">
        {{ formattedDate }}
      </p>
    </div>
  </button>
</template>
