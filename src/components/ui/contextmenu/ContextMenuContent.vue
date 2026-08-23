<script setup lang="ts">
import { inject, nextTick, onUnmounted, type Ref, ref, watch } from 'vue';

interface Props {
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	class: '',
});

const isOpen = inject<Ref<boolean>>('contextMenuOpen');
const position = inject<Ref<{ x: number; y: number }>>('contextMenuPosition');
const closeMenu = inject<() => void>('closeContextMenu');

const menuRef = ref<HTMLDivElement | null>(null);
// El menú se dibuja donde cayó el clic, pero si el clic fue cerca del borde
// —abajo del terminal, o en la última fila de la galería— la parte de abajo
// quedaba fuera de la ventana y no había forma de llegar a los ítems. Estas
// coordenadas son las corregidas para que entre siempre.
const placement = ref({ x: 0, y: 0 });

const VIEWPORT_MARGIN = 8;

function handleClickOutside(event: MouseEvent) {
	if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
		closeMenu?.();
	}
}

// Escape cierra el menú y ahí se termina: sin frenar la tecla, la misma
// pulsación seguía viaje y cerraba también lo que hubiera detrás —el overlay
// del terminal, la vista de la imagen— cuando lo único que se quería era salir
// del menú.
function handleEscape(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.stopPropagation();
		closeMenu?.();
	}
}

function removeListeners() {
	document.removeEventListener('click', handleClickOutside);
	document.removeEventListener('keydown', handleEscape, { capture: true });
}

async function keepInsideViewport() {
	placement.value = { x: position?.value.x ?? 0, y: position?.value.y ?? 0 };

	await nextTick();

	const menu = menuRef.value;
	if (!menu) {
		return;
	}

	const { width, height } = menu.getBoundingClientRect();
	const maxX = window.innerWidth - width - VIEWPORT_MARGIN;
	const maxY = window.innerHeight - height - VIEWPORT_MARGIN;

	placement.value = {
		x: Math.max(VIEWPORT_MARGIN, Math.min(placement.value.x, maxX)),
		y: Math.max(VIEWPORT_MARGIN, Math.min(placement.value.y, maxY)),
	};
}

if (isOpen) {
	watch(isOpen, (value) => {
		if (value) {
			void keepInsideViewport();
			document.addEventListener('click', handleClickOutside);
			document.addEventListener('keydown', handleEscape, { capture: true });
		} else {
			removeListeners();
		}
	});
}

if (position) {
	watch(position, () => {
		if (isOpen?.value) {
			void keepInsideViewport();
		}
	});
}

onUnmounted(removeListeners);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menuRef"
      :class="[props.class, 'fixed z-50 min-w-50 overflow-visible rounded-corner border border-ui-border p-1 text-tx-main shadow-lg bg-ui-bg/80 backdrop-blur-md']"
      role="menu"
      :style="{
        left: `${placement.x}px`,
        top: `${placement.y}px`,
      }"
    >
      <slot />
    </div>
  </Teleport>
</template>
