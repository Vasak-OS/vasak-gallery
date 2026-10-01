<script setup lang="ts">
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '@vasakgroup/vue-libvasak';
import { computed, ref } from 'vue';
import { useMonthLabels } from '@/composables/useMonthLabels';
import type { TimelineEntry } from '@/types/gallery';

const props = withDefaults(
	defineProps<{
		entries: TimelineEntry[];
		activeKey: string | null;
		/**
		 * Desplegada siempre, sin esperar al ratón ni al foco.
		 *
		 * Es la barra que se abre encima de la grilla en una ventana angosta:
		 * ahí se la pidió a propósito, así que tiene que mostrar los meses y
		 * no la columna de puntos.
		 */
		alwaysExpanded?: boolean;
	}>(),
	{ alwaysExpanded: false }
);

const emit = defineEmits<{ jump: [key: string] }>();

const { monthLong, monthShort } = useMonthLabels();
const { t } = useI18n();

const isHovered = ref(false);
const hasFocus = ref(false);

/**
 * Si la barra está abierta, por el ratón **o por el teclado**.
 *
 * Antes dependía sólo de `@mouseenter`, así que con el teclado no se abría
 * nunca: aunque el Tab llegara a un mes, su etiqueta seguía en `opacity-0` y no
 * había forma de saber a cuál se había llegado.
 */
const expanded = computed(() => props.alwaysExpanded || isHovered.value || hasFocus.value);

/**
 * Cómo se anuncia un mes: «Septiembre de 2026, 42 elementos».
 *
 * Lo que se ve es el mes abreviado y un número suelto, que fuera de contexto no
 * dice de qué año es ni de qué son esos elementos. El nombre accesible lo dice
 * entero, que es lo que hace que la lista se pueda recorrer sin ver la pantalla.
 */
const monthName = (entry: TimelineEntry): string =>
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
		let group = map.get(e.year);
		if (!group) {
			group = { year: e.year, months: [] };
			map.set(e.year, group);
		}
		group.months.push(e);
	}
	return Array.from(map.values()).sort((a, b) => b.year - a.year);
});
</script>

<template>
  <nav
    class="relative flex shrink-0 flex-col border-l border-ui-line bg-ui-bg transition-[width] duration-200"
    :class="expanded ? 'w-28' : 'w-7'"
    :aria-label="t('components.timeline.label')"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @focusin="hasFocus = true"
    @focusout="hasFocus = false"
  >
    <!--
      Un `nav` con nombre: es una forma de moverse por la galería, y así un lector
      de pantalla la ofrece como tal en vez de leerla como una lista de textos
      sueltos.

      No tiene overflow: el desplazamiento interno lo maneja el div de adentro.
      Los globos ya no dependen de eso — el `Tooltip` de la librería se dibuja en
      el `body` y se acomoda para no salirse de la ventana.
    -->
    <!-- Línea vertical -->
    <div class="pointer-events-none absolute right-3 top-0 h-full w-px bg-ui-border" />

    <!-- Contenido scrolleable -->
    <div class="flex flex-col overflow-y-auto py-3">
      <template v-for="group in grouped" :key="group.year">

        <!-- Año -->
        <div class="relative mb-1 flex w-full items-center justify-end pr-6">
          <div class="absolute right-[9px] h-2 w-2 rounded-corner-full border-2 border-primary bg-ui-bg" />
          <h2
            class="mr-8 whitespace-nowrap text-xs font-bold text-tx-main transition-opacity duration-150"
            :class="expanded ? 'opacity-100' : 'opacity-0'"
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
        <!--
          El globo es el `Tooltip` de la librería: sale a la izquierda del mes,
          con la superficie flotante y la sombra del sistema, y se apaga cuando
          la barra está desplegada, que ya muestra lo mismo. Antes era un `div`
          con una flecha dibujada con bordes.
        -->
        <Tooltip
          v-for="entry in group.months"
          :key="entry.key"
          class="block w-full"
          :disabled="expanded"
        >
          <TooltipTrigger class="block w-full">
            <button
              type="button"
              :aria-label="monthName(entry)"
              :aria-current="activeKey === entry.key ? 'true' : undefined"
              class="group/month relative flex w-full cursor-pointer items-center justify-end py-[3px] pr-6 transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus focus-visible:ring-inset"
              @click="emit('jump', entry.key)"
            >
              <!-- Tick -->
              <div
                class="absolute right-[10px] h-1.5 w-1.5 rounded-corner-full transition-all duration-150"
                :class="activeKey === entry.key
                  ? 'scale-125 bg-primary'
                  : 'bg-ui-line group-hover/month:bg-tx-muted'"
              />

              <!-- Label expandido -->
              <span
                class="mr-8 whitespace-nowrap text-xs transition-opacity duration-150"
                :class="[
                  expanded ? 'opacity-100' : 'opacity-0',
                  activeKey === entry.key ? 'font-semibold text-primary' : 'text-tx-muted',
                ]"
              >
                {{ monthShort(entry.month) }}
                <span class="opacity-50">{{ entry.count }}</span>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" :side-offset="12">
            {{ monthShort(entry.month) }} {{ entry.year }}
            <span class="ml-1 text-tx-muted">{{ entry.count }}</span>
          </TooltipContent>
        </Tooltip>

      </template>
    </div>
  </nav>
</template>
