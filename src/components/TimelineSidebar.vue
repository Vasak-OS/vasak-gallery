<script setup lang="ts">
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { computed, ref } from 'vue';
import { useMonthLabels } from '@/composables/useMonthLabels';
import type { TimelineEntry } from '@/types/gallery';

const props = defineProps<{
	entries: TimelineEntry[];
	activeKey: string | null;
}>();

const emit = defineEmits<{ jump: [key: string] }>();

const { monthLong, monthShort } = useMonthLabels();
const { t } = useI18n();

const isHovered = ref(false);
const tieneFoco = ref(false);

/**
 * Si la barra está abierta, por el ratón **o por el teclado**.
 *
 * Antes dependía sólo de `@mouseenter`, así que con el teclado no se abría
 * nunca: aunque el Tab llegara a un mes, su etiqueta seguía en `opacity-0` y no
 * había forma de saber a cuál se había llegado.
 */
const desplegada = computed(() => isHovered.value || tieneFoco.value);

/**
 * Cómo se anuncia un mes: «Septiembre de 2026, 42 elementos».
 *
 * Lo que se ve es el mes abreviado y un número suelto, que fuera de contexto no
 * dice de qué año es ni de qué son esos elementos. El nombre accesible lo dice
 * entero, que es lo que hace que la lista se pueda recorrer sin ver la pantalla.
 */
const nombreDelMes = (entry: TimelineEntry): string =>
	t('components.timeline.monthLabel')
		.replace('{0}', monthLong(entry.month))
		.replace('{1}', String(entry.year))
		.replace('{2}', String(entry.count));

interface YearGroup {
	year: number;
	months: TimelineEntry[];
}

const grouped = computed<YearGroup[]>(() => {
	const map = new Map<number, YearGroup>();
	for (const e of props.entries) {
		let grupo = map.get(e.year);
		if (!grupo) {
			grupo = { year: e.year, months: [] };
			map.set(e.year, grupo);
		}
		grupo.months.push(e);
	}
	return Array.from(map.values()).sort((a, b) => b.year - a.year);
});
</script>

<template>
  <!--
    Un `nav` con nombre: es una forma de moverse por la galería, y así un lector
    de pantalla la ofrece como tal en vez de leerla como una lista de textos
    sueltos.

    No tiene overflow — así los globos pueden salir hacia la izquierda. El
    desplazamiento interno lo maneja el div de adentro.
  -->
  <nav
    class="relative flex shrink-0 flex-col border-l border-ui-border bg-ui-bg/60 backdrop-blur-sm transition-[width] duration-200"
    :class="desplegada ? 'w-28' : 'w-7'"
    :aria-label="t('components.timeline.label')"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @focusin="tieneFoco = true"
    @focusout="tieneFoco = false"
  >
    <!-- Línea vertical -->
    <div class="pointer-events-none absolute right-3 top-0 h-full w-px bg-ui-border" />

    <!-- Contenido scrolleable -->
    <div class="flex flex-col overflow-y-auto py-3">
      <template v-for="group in grouped" :key="group.year">

        <!-- Año -->
        <div class="relative mb-1 flex w-full items-center justify-end pr-6">
          <div class="absolute right-[9px] h-2 w-2 rounded-full border-2 border-primary bg-ui-bg" />
          <h2
            class="mr-8 whitespace-nowrap text-xs font-bold text-tx-main transition-opacity duration-150"
            :class="desplegada ? 'opacity-100' : 'opacity-0'"
          >
            {{ group.year }}
          </h2>
        </div>

        <!-- Meses -->
        <!--
          Un botón y no un `div` con `@click`: el Tab lo alcanza, Enter y la
          barra espaciadora lo activan, y un lector de pantalla lo anuncia como
          algo que se puede apretar. Las tres cosas salen de usar el elemento
          que corresponde, y ninguna de ponerle un `tabindex` al `div`.
        -->
        <button
          v-for="entry in group.months"
          :key="entry.key"
          type="button"
          :aria-label="nombreDelMes(entry)"
          :aria-current="activeKey === entry.key ? 'true' : undefined"
          class="group/month relative flex w-full cursor-pointer items-center justify-end py-[3px] pr-6 transition-colors hover:bg-ui-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          @click="emit('jump', entry.key)"
        >
          <!-- Tick -->
          <div
            class="absolute right-[10px] h-1.5 w-1.5 rounded-full transition-all duration-150"
            :class="activeKey === entry.key
              ? 'scale-125 bg-primary'
              : 'bg-ui-border group-hover/month:bg-tx-muted'"
          />

          <!-- Label expandido -->
          <span
            class="mr-8 whitespace-nowrap text-xs transition-opacity duration-150"
            :class="[
              desplegada ? 'opacity-100' : 'opacity-0',
              activeKey === entry.key ? 'font-semibold text-primary' : 'text-tx-muted',
            ]"
          >
            {{ monthShort(entry.month) }}
            <span class="opacity-50">{{ entry.count }}</span>
          </span>

          <!-- Tooltip colapsado: sale a la izquierda, centrado en el tick -->
          <Transition name="tooltip">
            <div
              v-if="!desplegada"
              class="pointer-events-none absolute right-full top-1/2 z-100 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-corner border border-ui-border bg-ui-bg px-2 py-1 text-xs text-tx-main shadow-lg group-hover/month:block"
            >
              {{ monthShort(entry.month) }} {{ entry.year }}
              <span class="ml-1 opacity-50">{{ entry.count }}</span>
              <!-- Flecha apuntando a la derecha -->
              <span class="absolute right-[-5px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-ui-border" />
              <span class="absolute right-[-4px] top-1/2 -translate-y-1/2 border-4 border-transparent border-l-ui-bg" />
            </div>
          </Transition>
        </button>

      </template>
    </div>
  </nav>
</template>

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.1s ease;
}
.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
