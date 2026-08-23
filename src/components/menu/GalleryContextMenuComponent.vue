<script setup lang="ts">
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { computed } from 'vue';
import ContextMenuContent from '@/components/ui/contextmenu/ContextMenuContent.vue';
import ContextMenuItem from '@/components/ui/contextmenu/ContextMenuItem.vue';
import ContextMenuSeparator from '@/components/ui/contextmenu/ContextMenuSeparator.vue';
import ContextMenuSub from '@/components/ui/contextmenu/ContextMenuSub.vue';
import ContextMenuSubContent from '@/components/ui/contextmenu/ContextMenuSubContent.vue';
import ContextMenuSubTrigger from '@/components/ui/contextmenu/ContextMenuSubTrigger.vue';
import type { FilterType, MediaItem, SortOrder } from '@/types/gallery';

interface Props {
	/** La foto o el video sobre el que se hizo clic; nulo si fue sobre el fondo. */
	item: MediaItem | null;
	/** Abrir sobra cuando el menú se pide sobre la imagen ya abierta. */
	showOpen?: boolean;
	/** Sobre el fondo se ofrece ordenar y recargar; sobre la imagen abierta, no. */
	showViewOptions?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	showOpen: true,
	showViewOptions: true,
	class: '',
});

const emit = defineEmits<{
	open: [item: MediaItem];
	openWithSystem: [item: MediaItem];
	copyImage: [item: MediaItem];
	copyPath: [item: MediaItem];
	showInFiles: [item: MediaItem];
	setWallpaper: [item: MediaItem];
	reload: [];
	scan: [];
	filter: [type: FilterType];
	sort: [order: SortOrder];
}>();

const { t } = useI18n();

// Copiar la imagen y ponerla de fondo sólo tienen sentido con una imagen: de un
// video no hay nada que copiar al portapapeles, y el fondo de escritorio con
// video lo prepara el panel de configuración, que sabe recodificarlo.
const isImage = computed(() => props.item?.media_type === 'image');
</script>

<template>
  <ContextMenuContent :class="props.class">
    <template v-if="props.item">
      <ContextMenuItem v-if="props.showOpen" @select="emit('open', props.item)">
        {{ t('components.contextMenu.open') }}
      </ContextMenuItem>
      <ContextMenuItem @select="emit('openWithSystem', props.item)">
        {{ t('components.contextMenu.openWithSystem') }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem v-if="isImage" @select="emit('copyImage', props.item)">
        {{ t('components.contextMenu.copyImage') }}
      </ContextMenuItem>
      <ContextMenuItem @select="emit('copyPath', props.item)">
        {{ t('components.contextMenu.copyPath') }}
      </ContextMenuItem>
      <ContextMenuItem @select="emit('showInFiles', props.item)">
        {{ t('components.contextMenu.showInFiles') }}
      </ContextMenuItem>
      <template v-if="isImage">
        <ContextMenuSeparator />
        <ContextMenuItem @select="emit('setWallpaper', props.item)">
          {{ t('components.contextMenu.setWallpaper') }}
        </ContextMenuItem>
      </template>
    </template>

    <template v-else-if="props.showViewOptions">
      <ContextMenuItem @select="emit('reload')">
        {{ t('components.contextMenu.reload') }}
      </ContextMenuItem>
      <ContextMenuItem @select="emit('scan')">
        {{ t('components.contextMenu.scan') }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          {{ t('components.contextMenu.filter') }}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem @select="emit('filter', 'all')">
            {{ t('components.contextMenu.filterAll') }}
          </ContextMenuItem>
          <ContextMenuItem @select="emit('filter', 'image')">
            {{ t('components.contextMenu.filterImages') }}
          </ContextMenuItem>
          <ContextMenuItem @select="emit('filter', 'video')">
            {{ t('components.contextMenu.filterVideos') }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          {{ t('components.contextMenu.sort') }}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem @select="emit('sort', 'newest')">
            {{ t('components.contextMenu.sortNewest') }}
          </ContextMenuItem>
          <ContextMenuItem @select="emit('sort', 'oldest')">
            {{ t('components.contextMenu.sortOldest') }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
    </template>
  </ContextMenuContent>
</template>
