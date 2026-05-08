<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { LightboxProps, MediaItem } from '@/types/gallery';

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<LightboxProps>();

const emit = defineEmits<{
	close: [];
	navigate: [item: MediaItem];
}>();

// ─── Navegación ───────────────────────────────────────────────────────────────

const currentIndex = computed(() =>
	props.items.findIndex((i) => i.id === props.currentItem?.id)
);

const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < props.items.length - 1);

function navigatePrev() {
	if (hasPrev.value) emit('navigate', props.items[currentIndex.value - 1]);
}

function navigateNext() {
	if (hasNext.value) emit('navigate', props.items[currentIndex.value + 1]);
}

// ─── Zoom & Pan (solo imágenes) ───────────────────────────────────────────────

const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.15;

let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

const imageTransform = computed(
	() => `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`
);

const imageCursor = computed(() => {
	if (scale.value > 1) return isDragging.value ? 'grabbing' : 'grab';
	return 'default';
});

function resetZoom() {
	scale.value = 1;
	translateX.value = 0;
	translateY.value = 0;
}

function onWheel(e: WheelEvent) {
	e.preventDefault();
	const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
	scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + delta));
	// Si vuelve a escala 1, centrar
	if (scale.value <= 1) {
		scale.value = 1;
		translateX.value = 0;
		translateY.value = 0;
	}
}

function onMouseDown(e: MouseEvent) {
	if (scale.value <= 1) return;
	e.preventDefault();
	isDragging.value = true;
	dragStart = { x: e.clientX, y: e.clientY, tx: translateX.value, ty: translateY.value };
}

function onMouseMove(e: MouseEvent) {
	if (!isDragging.value) return;
	translateX.value = dragStart.tx + (e.clientX - dragStart.x);
	translateY.value = dragStart.ty + (e.clientY - dragStart.y);
}

function onMouseUp() {
	isDragging.value = false;
}

// ─── Video player state ───────────────────────────────────────────────────────

const videoRef = ref<HTMLVideoElement | null>(null);
const isPlaying = ref(false);
const isMuted = ref(true); // arranca muted para permitir autoplay
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);
const showControls = ref(true);
const videoError = ref<string | null>(null);
let controlsTimer: ReturnType<typeof setTimeout> | null = null;
// Evita llamar play() mientras ya hay una Promise pendiente
let playPromise: Promise<void> | null = null;

function togglePlay() {
	if (!videoRef.value) return;
	const video = videoRef.value;

	// Si el video no tiene datos suficientes todavía, ignorar
	if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;

	if (video.paused) {
		playPromise = video.play().catch((err) => {
			console.warn('Video play failed:', err);
		}).finally(() => {
			playPromise = null;
		});
	} else {
		// Solo pausar si no hay un play() en vuelo
		if (playPromise) {
			playPromise.then(() => video.pause());
		} else {
			video.pause();
		}
	}
}

function toggleMute() {
	if (!videoRef.value) return;
	videoRef.value.muted = !videoRef.value.muted;
	isMuted.value = videoRef.value.muted;
}

function onTimeUpdate() {
	if (!videoRef.value) return;
	currentTime.value = videoRef.value.currentTime;
}

function onLoadedMetadata() {
	if (!videoRef.value) return;
	duration.value = videoRef.value.duration;
	isPlaying.value = !videoRef.value.paused;
}

function onVideoPlay() { isPlaying.value = true; }
function onVideoPause() { isPlaying.value = false; }

function onVideoError(e: Event) {
	const video = e.target as HTMLVideoElement;
	const code = video.error?.code;
	const MEDIA_ERR: Record<number, string> = {
		1: 'Carga abortada',
		2: 'Error de red',
		3: 'Codec no soportado por el WebView',
		4: 'Formato no soportado por el WebView',
	};
	videoError.value = MEDIA_ERR[code ?? 0] ?? 'Error desconocido al reproducir el video';
	isPlaying.value = false;
}

async function openWithSystem() {
	if (!props.currentItem) return;
	try {
		await shellOpen(props.currentItem.original_path);
	} catch (err) {
		console.error('Failed to open with system player:', err);
	}
}

function seekTo(e: Event) {
	if (!videoRef.value) return;
	videoRef.value.currentTime = Number((e.target as HTMLInputElement).value);
}

function setVolume(e: Event) {
	if (!videoRef.value) return;
	const val = Number((e.target as HTMLInputElement).value);
	volume.value = val;
	videoRef.value.volume = val;
	isMuted.value = val === 0;
}

function formatTime(secs: number): string {
	if (!isFinite(secs)) return '0:00';
	const m = Math.floor(secs / 60);
	const s = Math.floor(secs % 60).toString().padStart(2, '0');
	return `${m}:${s}`;
}

function resetControlsTimer() {
	showControls.value = true;
	if (controlsTimer) clearTimeout(controlsTimer);
	controlsTimer = setTimeout(() => {
		if (isPlaying.value) showControls.value = false;
	}, 3000);
}

// ─── Keyboard & lifecycle ─────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
	if (!props.isOpen) return;
	switch (e.key) {
		case 'Escape': emit('close'); break;
		case 'ArrowLeft': navigatePrev(); break;
		case 'ArrowRight': navigateNext(); break;
		case ' ':
			if (props.currentItem?.media_type === 'video') {
				e.preventDefault();
				togglePlay();
			}
			break;
		case '+': case '=':
			if (props.currentItem?.media_type === 'image') {
				scale.value = Math.min(MAX_SCALE, scale.value + ZOOM_STEP * 2);
			}
			break;
		case '-':
			if (props.currentItem?.media_type === 'image') {
				scale.value = Math.max(MIN_SCALE, scale.value - ZOOM_STEP * 2);
				if (scale.value <= 1) resetZoom();
			}
			break;
		case '0': resetZoom(); break;
	}
}

// Reset state when item changes
watch(
	() => props.currentItem,
	() => {
		resetZoom();
		isPlaying.value = false;
		currentTime.value = 0;
		duration.value = 0;
		videoError.value = null;
		playPromise = null;
	}
);

watch(
	() => props.isOpen,
	(open) => {
		document.body.style.overflow = open ? 'hidden' : '';
		if (!open) {
			resetZoom();
			if (videoRef.value) videoRef.value.pause();
		}
	}
);

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => {
	window.removeEventListener('keydown', handleKeydown);
	document.body.style.overflow = '';
	if (controlsTimer) clearTimeout(controlsTimer);
});

const fileName = computed(() => props.currentItem?.original_path.split('/').pop() ?? '');
const mediaSrc = computed(() =>
	props.currentItem ? convertFileSrc(props.currentItem.original_path) : ''
);
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="isOpen && currentItem"
        class="fixed inset-0 z-9999 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        @mousemove="currentItem.media_type === 'video' ? resetControlsTimer() : undefined"
      >

        <!-- ── Backdrop click to close ── -->
        <div class="absolute inset-0" @click.self="emit('close')" />

        <!-- ── Close button ── -->
        <button
          class="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-md transition hover:border-white/40 hover:bg-white/15 hover:text-white"
          aria-label="Cerrar"
          @click="emit('close')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <!-- ── Counter ── -->
        <div
          v-if="items.length > 1"
          class="absolute left-4 top-4 z-10 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-md"
        >
          {{ currentIndex + 1 }} / {{ items.length }}
        </div>

        <!-- ── Prev button ── -->
        <button
          v-if="hasPrev"
          class="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-md transition hover:border-primary/60 hover:bg-primary/15 hover:text-white active:scale-95"
          aria-label="Anterior"
          @click="navigatePrev"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <!-- ── Next button ── -->
        <button
          v-if="hasNext"
          class="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-md transition hover:border-primary/60 hover:bg-primary/15 hover:text-white active:scale-95"
          aria-label="Siguiente"
          @click="navigateNext"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <!-- ════════════════════════════════════════════════════════════════════
             IMAGE VIEWER
        ═════════════════════════════════════════════════════════════════════ -->
        <div
          v-if="currentItem.media_type === 'image'"
          class="relative flex h-full w-full items-center justify-center overflow-auto"
          @wheel.prevent="onWheel"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @dblclick="resetZoom"
        >
          <img
            :src="mediaSrc"
            :alt="fileName"
            :style="{ transform: imageTransform, cursor: imageCursor, userSelect: 'none' }"
            class="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-[0_20px_80px_rgba(0,0,0,0.6)] transition-transform duration-100 will-change-transform"
            draggable="false"
          />

          <!-- Zoom indicator -->
          <Transition name="fade">
            <div
              v-if="scale !== 1"
              class="absolute bottom-20 right-4 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs font-mono text-white/70 backdrop-blur-md"
            >
              {{ Math.round(scale * 100) }}%
            </div>
          </Transition>

          <!-- Zoom hint -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-xs text-white/40 backdrop-blur-md select-none">
            Rueda para zoom · Arrastra para mover · Doble clic para resetear
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════════════════
             VIDEO PLAYER
        ═════════════════════════════════════════════════════════════════════ -->
        <div
          v-else-if="currentItem.media_type === 'video'"
          class="relative flex h-full w-full flex-col items-center justify-center"
          @mousemove="resetControlsTimer"
          @click.self="togglePlay"
        >
          <!-- Video element (sin controles nativos) -->
          <video
            ref="videoRef"
            :src="mediaSrc"
            class="max-h-[calc(100vh-100px)] max-w-[90vw] rounded-xl object-contain shadow-[0_20px_80px_rgba(0,0,0,0.6)]"
            autoplay
            muted
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @play="onVideoPlay"
            @pause="onVideoPause"
            @error="onVideoError"
          />

          <!-- Error state -->
          <div
            v-if="videoError"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
          >
            <div class="rounded-2xl border border-white/10 bg-black/60 px-8 py-6 backdrop-blur-md flex flex-col items-center gap-3">
              <p class="text-3xl">🎬</p>
              <p class="text-sm font-medium text-white/90">El WebView no puede reproducir este video</p>
              <p class="text-xs text-white/50">{{ videoError }}</p>
              <p class="font-mono text-xs text-white/30 break-all max-w-sm">{{ fileName }}</p>
              <button
                class="mt-1 rounded-corner border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-medium text-white transition hover:border-primary/70 hover:bg-primary/25 active:scale-95"
                @click="openWithSystem"
              >
                Abrir con reproductor del sistema
              </button>
            </div>
          </div>

          <!-- ── Custom controls overlay ── -->
          <Transition name="controls">
            <div
              v-show="showControls"
              class="absolute bottom-0 left-0 right-0 flex flex-col gap-2 rounded-b-xl bg-linear-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-10"
            >
              <!-- Progress bar -->
              <div class="flex items-center gap-3">
                <span class="w-10 text-right font-mono text-xs text-white/70">{{ formatTime(currentTime) }}</span>
                <div class="relative flex-1">
                  <input
                    type="range"
                    :min="0"
                    :max="duration || 100"
                    :value="currentTime"
                    step="0.1"
                    class="video-range w-full"
                    @input="seekTo"
                  />
                  <!-- filled track -->
                  <div
                    class="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
                    :style="{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }"
                  />
                </div>
                <span class="w-10 font-mono text-xs text-white/70">{{ formatTime(duration) }}</span>
              </div>

              <!-- Buttons row -->
              <div class="flex items-center gap-2">
                <!-- Play/Pause -->
                <button
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-primary/60 hover:bg-primary/20 active:scale-95"
                  :aria-label="isPlaying ? 'Pausar' : 'Reproducir'"
                  @click="togglePlay"
                >
                  <!-- Play icon -->
                  <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <!-- Pause icon -->
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                </button>

                <!-- Mute -->
                <button
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-primary/60 hover:bg-primary/20 active:scale-95"
                  :aria-label="isMuted ? 'Activar sonido' : 'Silenciar'"
                  @click="toggleMute"
                >
                  <svg v-if="!isMuted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                </button>

                <!-- Volume slider -->
                <div class="relative w-20">
                  <input
                    type="range"
                    :min="0"
                    :max="1"
                    :value="volume"
                    step="0.05"
                    class="video-range w-full"
                    @input="setVolume"
                  />
                  <div
                    class="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
                    :style="{ width: `${volume * 100}%` }"
                  />
                </div>

                <!-- Spacer -->
                <div class="flex-1" />

                <!-- File name -->
                <p class="max-w-xs truncate text-xs text-white/50">{{ fileName }}</p>
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── File info bar (images only) ── -->
        <div
          v-if="currentItem.media_type === 'image'"
          class="absolute left-4 top-4 z-10 max-w-xs truncate rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/50 backdrop-blur-md"
          :title="currentItem.original_path"
        >
          {{ fileName }}
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Lightbox transition ── */
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

/* ── Controls fade ── */
.controls-enter-active,
.controls-leave-active {
  transition: opacity 0.3s ease;
}
.controls-enter-from,
.controls-leave-to {
  opacity: 0;
}

/* ── Zoom indicator fade ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Custom range input ── */
.video-range {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.15);
  outline: none;
  cursor: pointer;
  position: relative;
}

.video-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #dd7878; /* --primary */
  border: 2px solid rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  position: relative;
  z-index: 1;
}

.video-range::-webkit-slider-thumb:hover {
  transform: scale(1.25);
  box-shadow: 0 0 0 4px rgba(221, 120, 120, 0.3);
}

.video-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #dd7878;
  border: 2px solid rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.video-range::-moz-range-track {
  background: transparent;
}
</style>
