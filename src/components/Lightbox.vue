<script setup lang="ts">
/** biome-ignore-all lint/style/useVueMultiWordComponentNames: la regla existe para
 * que el nombre de un componente no choque con un elemento HTML. Ninguno de estos
 * lo es, y renombrarlo obligaría a tocar cada uso sin ganar nada. */
/**
 * La foto o el video, a pantalla completa.
 *
 * **Es un diálogo**, y lo dibuja la librería: el foco entra al abrirlo, el Tab
 * da la vuelta adentro en vez de seguir por la grilla de atrás, Escape lo
 * cierra y al cerrarse el foco vuelve a la miniatura de la que salió. Antes era
 * un `div` con un velo: no se anunciaba como nada, el foco nunca entraba, y
 * salir con el teclado obligaba a tabular por las trescientas miniaturas que
 * quedaban debajo.
 *
 * `size="full"` es para que la librería no traiga su caja centrada —ancho
 * máximo, borde, relleno—: acá el diálogo **es** la pantalla, y el fondo lo
 * pone la clase que se le pasa.
 *
 * El comentario va acá y no arriba de la raíz de la plantilla: un comentario
 * ahí la convierte en un fragmento y se pierde la raíz.
 */
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import {
	ActionButton,
	Badge,
	Dialog,
	DialogContent,
	EmptyState,
	SeekBar,
	Slider,
} from '@vasakgroup/vue-libvasak';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useGalleryContextMenu } from '@/composables/useGalleryContextMenu';
import type { LightboxProps, MediaItem } from '@/types/gallery';

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<LightboxProps>();

const emit = defineEmits<{
	close: [];
	navigate: [item: MediaItem];
}>();

const { t } = useI18n();

// ─── Navegación ───────────────────────────────────────────────────────────────

const currentIndex = computed(() => props.items.findIndex((i) => i.id === props.currentItem?.id));

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
const videoErrorKey = ref<string | null>(null);
let controlsTimer: ReturnType<typeof setTimeout> | null = null;
// Evita llamar play() mientras ya hay una Promise pendiente
let playPromise: Promise<void> | null = null;

function togglePlay() {
	if (!videoRef.value) return;
	const video = videoRef.value;

	// Si el video no tiene datos suficientes todavía, ignorar
	if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;

	if (video.paused) {
		playPromise = video
			.play()
			.catch((err) => {
				console.warn('Video play failed:', err);
			})
			.finally(() => {
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

function onVideoPlay() {
	isPlaying.value = true;
}
function onVideoPause() {
	isPlaying.value = false;
}

// Se guarda la clave, no el texto: así el mensaje sigue al idioma activo
// aunque el error haya ocurrido antes de cambiarlo.
const MEDIA_ERR_KEYS: Record<number, string> = {
	1: 'components.lightbox.videoErrors.aborted',
	2: 'components.lightbox.videoErrors.network',
	3: 'components.lightbox.videoErrors.decode',
	4: 'components.lightbox.videoErrors.format',
};

function onVideoError(e: Event) {
	const video = e.target as HTMLVideoElement;
	const code = video.error?.code;
	videoErrorKey.value = MEDIA_ERR_KEYS[code ?? 0] ?? 'components.lightbox.videoErrors.unknown';
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

/** Al soltar la barra: a dónde saltar, en segundos. */
function seekTo(seconds: number) {
	if (!videoRef.value) return;
	videoRef.value.currentTime = seconds;
	currentTime.value = seconds;
}

function setVolume(val: number) {
	volume.value = val;
	if (!videoRef.value) return;
	videoRef.value.volume = val;
	isMuted.value = val === 0;
}

/** Lo que oye un lector de pantalla en el volumen: «60 %» y no «0.6». */
const volumeText = (val: number) => `${Math.round(val * 100)} %`;

function resetControlsTimer() {
	showControls.value = true;
	if (controlsTimer) clearTimeout(controlsTimer);
	controlsTimer = setTimeout(() => {
		if (isPlaying.value) showControls.value = false;
	}, 3000);
}

// ─── Keyboard & lifecycle ─────────────────────────────────────────────────────

/**
 * Las teclas que son del visor y no del diálogo.
 *
 * Escape **no** está acá: lo cierra `DialogContent`, que además devuelve el
 * foco a la miniatura de la que se abrió. Atenderlo en los dos lugares no
 * rompía nada visible, pero pedía cerrar dos veces por cada tecla.
 */
function handleKeydown(e: KeyboardEvent) {
	if (!props.isOpen) return;
	switch (e.key) {
		case 'ArrowLeft':
			navigatePrev();
			break;
		case 'ArrowRight':
			navigateNext();
			break;
		case ' ':
			e.preventDefault();
			if (props.currentItem?.media_type === 'video') {
				togglePlay();
			}
			break;
		case '+':
		case '=':
			e.preventDefault();
			if (props.currentItem?.media_type === 'image') {
				scale.value = Math.min(MAX_SCALE, scale.value + ZOOM_STEP * 2);
			}
			break;
		case '-':
			e.preventDefault();
			if (props.currentItem?.media_type === 'image') {
				scale.value = Math.max(MIN_SCALE, scale.value - ZOOM_STEP * 2);
				if (scale.value <= 1) resetZoom();
			}
			break;
		case '0':
			resetZoom();
			break;
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
		videoErrorKey.value = null;
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

// Con la foto abierta el clic derecho ofrece lo mismo que en la grilla: es el
// momento en que se la está mirando y se la quiere copiar o poner de fondo.
// Abrir sobra —ya está abierta— y ordenar la grilla tampoco viene al caso.
const { showMenu } = useGalleryContextMenu();

function handleContextMenu(event: MouseEvent) {
	if (props.currentItem) {
		void showMenu(event, props.currentItem);
	}
}

const videoError = computed(() => (videoErrorKey.value ? t(videoErrorKey.value) : null));

const fileName = computed(() => props.currentItem?.original_path.split('/').pop() ?? '');

/**
 * Cómo se llama el diálogo.
 *
 * No hay `DialogTitle` visible —el nombre del archivo se dibuja en una píldora
 * con su propia forma, y el título de la librería trae la suya—, así que el
 * nombre va por `aria-label`. Sale del mismo `fileName` que se ve, que es lo
 * que evita que uno se quede viejo respecto del otro.
 */
const dialogLabel = computed(() => t('components.lightbox.label').replace('{0}', fileName.value));
const mediaSrc = computed(() =>
	props.currentItem ? convertFileSrc(props.currentItem.original_path) : ''
);
</script>

<template>
  <Dialog :open="isOpen && currentItem !== null" @update:open="emit('close')">
    <!-- El fondo es el de la ventana, opaco: el velo translúcido con desenfoque
         dejaba ver la grilla borrosa detrás de la foto, y en una superficie de
         capa el desenfoque cuesta y no muestra nada (decisión 8). -->
    <DialogContent size="full" :ariaLabel="dialogLabel" class="bg-ui-bg">
      <div
        v-if="currentItem"
        class="relative flex h-full w-full items-center justify-center"
        @mousemove="currentItem.media_type === 'video' ? resetControlsTimer() : undefined"
        @contextmenu="handleContextMenu"
      >
        <!-- ── Backdrop click to close ── -->
        <div class="absolute inset-0" @click.self="emit('close')" />

        <!-- ── Close button ──
             Los controles sobre la imagen van con la variante `overlay` de la
             librería: el velo `ui-overlay` sostiene el texto y el icono a 4,5:1
             sea cual sea la foto de abajo, y la sombra `surface-s` los despega
             del fondo cuando caen fuera de la foto. Eran blanco y negro escritos
             a mano, con siete SVG propios; los iconos ahora son los del tema. -->
        <ActionButton
          class="absolute right-4 top-4 z-10"
          variant="overlay"
          custom-class="shadow-surface-s"
          icon="window-close"
          label=""
          :icon-alt="t('components.lightbox.close')"
          @click="emit('close')"
        />

        <!-- ── Contador y nombre del archivo ──
             Iban los dos en `left-4 top-4`, uno encima del otro: con una foto
             abierta el nombre tapaba el contador entero. Ahora van en fila. -->
        <div class="absolute left-4 right-16 top-4 z-10 flex min-w-0 items-center gap-2">
          <span v-if="items.length > 1" class="flex shrink-0" data-counter>
            <Badge variant="overlay" size="md" class="tabular-nums shadow-surface-s">
              {{ currentIndex + 1 }} / {{ items.length }}
            </Badge>
          </span>
          <span
            v-if="currentItem.media_type === 'image'"
            class="flex min-w-0 max-w-xs"
            :title="currentItem.original_path"
            data-file-name
          >
            <Badge variant="overlay" size="md" class="shadow-surface-s">
              <span class="block truncate">{{ fileName }}</span>
            </Badge>
          </span>
        </div>

        <!-- ── Prev button ── -->
        <ActionButton
          v-if="hasPrev"
          class="absolute left-3 z-10"
          variant="overlay"
          custom-class="shadow-surface-s"
          size="lg"
          icon="go-previous"
          label=""
          :icon-alt="t('components.lightbox.prev')"
          @click="navigatePrev"
        />

        <!-- ── Next button ── -->
        <ActionButton
          v-if="hasNext"
          class="absolute right-3 z-10"
          variant="overlay"
          custom-class="shadow-surface-s"
          size="lg"
          icon="go-next"
          label=""
          :icon-alt="t('components.lightbox.next')"
          @click="navigateNext"
        />

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
            class="max-h-[90vh] max-w-[90vw] rounded-corner-m object-contain shadow-surface-xl transition-transform duration-100 will-change-transform"
            draggable="false"
          />

          <!-- Zoom indicator -->
          <Transition name="fade">
            <Badge
              v-if="scale !== 1"
              variant="overlay"
              size="md"
              class="absolute bottom-20 right-4 font-mono shadow-surface-s"
            >
              {{ Math.round(scale * 100) }}%
            </Badge>
          </Transition>

          <!-- Zoom hint -->
          <Badge
            variant="overlay"
            size="md"
            class="absolute bottom-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 select-none text-center shadow-surface-s"
          >
            {{ t('components.lightbox.zoomHint') }}
          </Badge>
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
            class="max-h-[calc(100vh-100px)] max-w-[90vw] rounded-corner-m object-contain shadow-surface-xl"
            autoplay
            muted
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @play="onVideoPlay"
            @pause="onVideoPause"
            @error="onVideoError"
          />

          <!-- Error state: el vacío de la librería, con el icono del tema donde
               había un 🎬 escrito. -->
          <div
            v-if="videoError"
            class="absolute inset-0 flex items-center justify-center p-4"
          >
            <div class="flex min-w-0 max-w-sm flex-col items-center rounded-corner-l border border-ui-line bg-ui-float shadow-surface-l">
              <EmptyState
                size="sm"
                icon="video-x-generic"
                :title="t('components.lightbox.videoUnsupported')"
                :note="videoError"
              >
                <p class="max-w-full break-all font-mono text-xs text-tx-muted">{{ fileName }}</p>
                <ActionButton :label="t('components.lightbox.openWithSystem')" @click="openWithSystem" />
              </EmptyState>
            </div>
          </div>

          <!-- ── Custom controls overlay ── -->
          <Transition name="controls">
            <div
              v-show="showControls"
              class="absolute bottom-0 left-0 right-0 flex flex-col gap-2 rounded-b-corner-m bg-linear-to-t from-ui-overlay via-ui-overlay to-transparent px-4 pb-4 pt-10"
            >
              <!-- Progress bar: la de la librería, que no se pelea con la
                   posición que llega mientras se arrastra. -->
              <SeekBar
                class="font-mono"
                :position="currentTime"
                :duration="duration"
                :step="0.1"
                :label="t('components.lightbox.seek')"
                @seek="seekTo"
              />

              <!-- Buttons row -->
              <div class="flex min-w-0 items-center gap-2">
                <!-- Play/Pause -->
                <ActionButton
                  variant="overlay"
                  custom-class="shadow-surface-s"
                  :icon="isPlaying ? 'media-playback-pause' : 'media-playback-start'"
                  label=""
                  :icon-alt="isPlaying ? t('components.lightbox.pause') : t('components.lightbox.play')"
                  @click="togglePlay"
                />

                <!-- Mute -->
                <ActionButton
                  variant="overlay"
                  custom-class="shadow-surface-s"
                  :icon="isMuted ? 'audio-volume-muted' : 'audio-volume-high'"
                  label=""
                  :icon-alt="isMuted ? t('components.lightbox.unmute') : t('components.lightbox.mute')"
                  @click="toggleMute"
                />

                <!-- Volume slider -->
                <Slider
                  class="w-20 shrink-0"
                  :model-value="volume"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  :label="t('components.lightbox.volume')"
                  :value-text="volumeText"
                  @update:model-value="setVolume"
                />

                <!-- Spacer -->
                <div class="flex-1" />

                <!-- File name -->
                <p class="min-w-0 max-w-xs truncate text-xs text-tx-muted">{{ fileName }}</p>
              </div>
            </div>
          </Transition>
        </div>

      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* La entrada y la salida del visor entero las hace `DialogContent`, que ya
   funde el velo: dos transiciones encima de lo mismo se peleaban el `opacity`. */

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
</style>
