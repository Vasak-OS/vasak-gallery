/**
 * Lo que la galería dejó de dibujar por su cuenta.
 *
 * Cinco piezas propias pasaron a ser las de la librería: el visor de fotos, la
 * pila de avisos, el estado vacío, el de carga, el de error y el icono del
 * tema. Lo que se comprueba acá es lo que **no se ve** y por eso no se nota si
 * se rompe: que el visor se anuncie como diálogo y encierre el foco, que los
 * tres estados de la grilla digan lo que son, y que un aviso de error
 * interrumpa mientras los demás esperan su turno.
 *
 * Las de abajo del todo miran el fuente en vez de montar. Un `import` a un
 * archivo que volvió a aparecer no lo ataja ninguna prueba montada: la que
 * fallaría es la del componente viejo, que ya no existe.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import {
	AlertMessage,
	EmptyState,
	LoadingState,
	olvidarLosIconosDelTema,
} from '@vasakgroup/vue-libvasak';
import { mount, type VueWrapper } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import ImageGrid from '@/components/ImageGrid.vue';
import Lightbox from '@/components/Lightbox.vue';
import WindowAppLayout from '@/layouts/WindowAppLayout.vue';
import { useNotification } from '@/composables/useNotification';
import type { MediaItem } from '@/types/gallery';
import { olvidarTodo, ponerTraduccion, responderInvoke } from './dobles';

const RAIZ = new URL('..', import.meta.url).pathname;

function foto(id: number): MediaItem {
	return {
		id,
		original_path: `/home/pato/Imágenes/foto-${id}.png`,
		thumbnail_path: `/home/pato/.cache/vasak-gallery/foto-${id}.png`,
		media_type: 'image',
		created_at: '2026-09-01T10:00:00Z',
		file_size: 1024,
	};
}

/**
 * Lo montado, para desmontarlo pase lo que pase.
 *
 * El visor se teletransporta al `body`, así que no se lo lleva el desmontaje de
 * la vista: una prueba que falla dejaría su panel puesto y la siguiente
 * encontraría **ése** al preguntar por `[role="dialog"]`.
 */
const vistas = new Set<VueWrapper>();

function anotar<T extends VueWrapper>(vista: T): T {
	vistas.add(vista);
	return vista;
}

afterEach(() => {
	for (const vista of vistas) vista.unmount();
	vistas.clear();
	for (const suelto of document.body.querySelectorAll('[role="dialog"]')) {
		suelto.parentElement?.remove();
	}
	const { notifications } = useNotification();
	notifications.value.splice(0);
	olvidarTodo();
	olvidarLosIconosDelTema();
});

const elPanel = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

/** El visor abierto sobre la segunda de tres fotos. */
function abrirElVisor() {
	const fotos = [foto(1), foto(2), foto(3)];
	return anotar(
		mount(Lightbox, {
			props: { isOpen: true, currentItem: fotos[1], items: fotos },
			attachTo: document.body,
		})
	);
}

/** Una tecla escrita con el foco dentro del visor, que es el camino normal. */
function teclearDentro(key: string) {
	elPanel()?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('el visor es un diálogo', () => {
	test('se anuncia como tal, y con el nombre del archivo', async () => {
		// Era un `div` con un velo: un lector de pantalla no anunciaba nada al
		// abrirlo, y lo que se estaba mirando no tenía nombre.
		ponerTraduccion('components.lightbox.label', 'Viendo {0}');
		abrirElVisor();
		await nextTick();

		expect(elPanel()?.getAttribute('aria-modal')).toBe('true');
		expect(elPanel()?.getAttribute('aria-label')).toBe('Viendo foto-2.png');
	});

	test('y ocupa la pantalla, no la caja centrada del diálogo', async () => {
		// Sin `size="full"` el visor quedaría dentro de un panel de 32 rem con
		// borde y relleno, en el medio de la pantalla. La foto se vería del
		// tamaño de un cuadro de diálogo.
		abrirElVisor();
		await nextTick();

		const clases = elPanel()?.className ?? '';
		expect(clases).not.toContain('max-w-lg');
		expect(clases).toContain('h-full');
	});

	test('el foco entra al abrirlo', async () => {
		// Sin esto el foco se queda en la miniatura de atrás, y el primer Tab
		// sigue recorriendo la grilla que el velo tapa.
		abrirElVisor();
		await nextTick();
		await nextTick();

		expect(document.activeElement).toBe(elPanel());
	});

	test('y el Tab da la vuelta adentro en vez de irse a la grilla', async () => {
		abrirElVisor();
		await nextTick();
		await nextTick();

		const botones = elPanel()?.querySelectorAll<HTMLElement>('button') ?? [];
		expect(botones.length).toBeGreaterThan(1);

		botones[botones.length - 1].focus();
		teclearDentro('Tab');
		await nextTick();

		expect(document.activeElement).toBe(botones[0]);
	});

	test('Escape lo cierra, y lo pide una sola vez', async () => {
		// Lo atendían los dos: el oyente propio del visor y el del diálogo. No
		// se veía —cerrar dos veces cierra igual— pero es la clase de cosa que
		// después hace saltar un paso de más en cualquier historial.
		const vista = abrirElVisor();
		await nextTick();
		await nextTick();

		teclearDentro('Escape');
		await nextTick();

		expect(vista.emitted('close')).toHaveLength(1);
	});

	test('las flechas siguen siendo del visor', async () => {
		// El diálogo se lleva Escape y el Tab; moverse entre fotos no.
		const vista = abrirElVisor();
		await nextTick();
		await nextTick();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await nextTick();

		expect(vista.emitted('navigate')).toHaveLength(1);
	});
});

describe('los tres estados de la grilla', () => {
	function grilla() {
		return anotar(mount(ImageGrid, { props: { autoScan: false } }));
	}

	test('mientras carga lo dice, y no sólo con un anillo que gira', async () => {
		// El estado de carga propio era un `div` girando: para quien no ve la
		// pantalla, la vista quedaba en blanco y sin explicación.
		//
		// La respuesta que no llega nunca es lo que deja la grilla parada en ese
		// estado: con una lista de verdad, el `await` se resuelve en la misma
		// vuelta de microtareas y lo que se ve ya es el resultado.
		responderInvoke('get_all_media', new Promise(() => {}));
		const vista = grilla();
		await nextTick();

		const carga = vista.findComponent(LoadingState);
		expect(carga.exists()).toBe(true);
		expect(carga.attributes('role')).toBe('status');
	});

	test('vacía ofrece escanear, dentro del estado vacío del sistema', async () => {
		responderInvoke('get_all_media', []);
		const vista = grilla();
		await new Promise((listo) => setTimeout(listo, 0));
		await nextTick();

		const vacio = vista.findComponent(EmptyState);
		expect(vacio.exists()).toBe(true);
		expect(vacio.text()).toContain('components.imageGrid.scanNow');
	});

	test('y el error va en el aviso del sistema, con tono de error', async () => {
		// El tono es lo que hace que un error de la galería se vea igual que uno
		// del gestor de archivos, y lo que le pone `role="alert"`: interrumpe,
		// en vez de esperar turno como los demás.
		responderInvoke('get_all_media', new Error('no se pudo leer la carpeta'));
		const vista = grilla();
		await new Promise((listo) => setTimeout(listo, 0));
		await nextTick();

		const aviso = vista.findComponent(AlertMessage);
		expect(aviso.exists()).toBe(true);
		expect(aviso.props('tone')).toBe('error');
		expect(aviso.attributes('role')).toBe('alert');
		expect(vista.text()).toContain('common.retry');
	});
});

describe('los avisos transitorios', () => {
	function ventana() {
		return anotar(
			mount(WindowAppLayout, {
				global: { stubs: { RouterView: { render: () => h('div') } } },
			})
		);
	}

	test('un error interrumpe y lo demás espera su turno', async () => {
		// Es el criterio que la galería ya tenía y que la librería se llevó: un
		// error conviene enterarse ahora, y un «copiado» puede esperar a que el
		// lector de pantalla termine la frase.
		ventana();
		const { notify } = useNotification();

		notify('no se pudo copiar', 'error');
		notify('copiado');
		await nextTick();

		const avisos = [...document.body.querySelectorAll('[aria-atomic="true"]')];
		expect(avisos.map((aviso) => aviso.getAttribute('role'))).toEqual(['alert', 'status']);
	});
});

describe('lo que la galería ya no dibuja', () => {
	const borrados = [
		'src/components/ui/NotificationToast.vue',
		'src/components/ui/StatePanel.vue',
		'src/composables/useReactiveIcon.ts',
	];

	test('los tres archivos se fueron', async () => {
		for (const ruta of borrados) {
			expect(await Bun.file(`${RAIZ}${ruta}`).exists()).toBe(false);
		}
	});

	test('y nadie los importa', async () => {
		// Un `import` a un archivo que volvió no lo ataja ninguna prueba
		// montada: lo que fallaría es la prueba del componente que ya no está.
		const fuentes = [...new Bun.Glob('src/**/*.{vue,ts}').scanSync(RAIZ)];
		expect(fuentes.length).toBeGreaterThan(10);

		const culpables: string[] = [];
		for (const ruta of fuentes) {
			const texto = await Bun.file(`${RAIZ}${ruta}`).text();
			if (/NotificationToast|StatePanel|useReactiveIcon/.test(texto)) culpables.push(ruta);
		}

		expect(culpables).toEqual([]);
	});
});
