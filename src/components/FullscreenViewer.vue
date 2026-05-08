<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { onMounted, onUnmounted, watch } from 'vue';

interface Props {
	originalPath: string;
	mediaType: 'image' | 'video';
	isOpen: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	close: [];
}>();

function handleClose() {
	emit('close');
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		handleClose();
	}
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === e.currentTarget) {
		handleClose();
	}
}

onMounted(() => {
	window.addEventListener('keydown', handleKeydown);
	if (props.isOpen) {
		document.body.style.overflow = 'hidden';
	}
});

onUnmounted(() => {
	window.removeEventListener('keydown', handleKeydown);
	document.body.style.overflow = '';
});

watch(
	() => props.isOpen,
	(isVisible) => {
		document.body.style.overflow = isVisible ? 'hidden' : '';
	}
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4 text-white backdrop-blur-sm"
      @click="handleBackdropClick"
    >
      <button
        class="absolute right-5 top-5 z-[10000] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
        @click="handleClose"
        aria-label="Cerrar visor"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div class="flex max-h-[80vh] max-w-[90vw] items-center justify-center">
        <img
          v-if="mediaType === 'image'"
          :src="convertFileSrc(originalPath)"
          :alt="originalPath"
          class="max-h-full max-w-full rounded-2xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        />

        <video
          v-else
          :src="convertFileSrc(originalPath)"
          class="max-h-full max-w-full rounded-2xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          controls
          autoplay
        />
      </div>

      <div class="absolute bottom-5 left-5 right-5 max-w-md rounded-2xl border border-white/10 bg-black/50 p-4 text-white backdrop-blur-md">
        <p class="mb-2 break-all font-mono text-xs text-white/70">
          {{ originalPath }}
        </p>
        <p class="text-sm font-medium">
          {{ mediaType === 'image' ? 'Imagen' : 'Video' }}
        </p>
      </div>

      <div class="absolute left-5 top-5 flex items-center gap-2 text-xs text-white/60">
        <span>Presiona</span>
        <kbd class="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-mono text-[11px] text-white/80">ESC</kbd>
        <span>para cerrar</span>
      </div>
    </div>
  </Teleport>
</template>
