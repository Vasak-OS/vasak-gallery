/**
 * La vista de la galería: la cabecera y dónde va la línea de tiempo.
 *
 * La cabecera es el `PageHeader` de la librería con los filtros como
 * `ActionButton` (decisión 3 de vue-libvasak#74: siguen siendo acciones, no un
 * selector con uno elegido). Los emojis de cada botón pasaron a iconos del
 * tema.
 *
 * Y en una ventana angosta va una columna por vez: por debajo de 30 rem la
 * línea de tiempo no se queda al lado de la grilla, se abre encima con el botón
 * de la cabecera, como en una aplicación de teléfono. Lo decide una consulta de
 * contenedor sobre la ventana, no un punto de corte de la pantalla: en
 * WebKitGTK `matchMedia` no avisa, y la vista no sabe en qué ventana está. Lo
 * que estas pruebas pueden ver son las clases y el estado; que a 240 y 360 se
 * vea bien lo dicen las capturas del banco.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { ActionButton, PageHeader } from '@vasakgroup/vue-libvasak';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { MediaItem } from '@/types/gallery';
import GalleryView from '@/views/GalleryView.vue';
import { olvidarTodo, responderInvoke } from './dobles';

let wrapper: VueWrapper | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	olvidarTodo();
});

const anItem: MediaItem = {
	id: 1,
	original_path: '/home/pato/Imágenes/a.jpg',
	thumbnail_path: '/home/pato/.cache/vasak-gallery/a.jpg',
	media_type: 'image',
	created_at: '2026-09-20T00:00:00Z',
	file_size: 1024,
};

async function mountView() {
	// El escaneo espera eventos del backend que acá no llegan: se lo deja
	// colgado y la grilla carga lo que hay.
	responderInvoke('scan_media', new Promise(() => {}));
	responderInvoke('get_all_media', [anItem]);
	const view = mount(GalleryView);
	await flushPromises();
	return view;
}

const toggle = (view: VueWrapper) =>
	view.findAllComponents(ActionButton).find((b) => b.props('icon') === 'x-office-calendar');

describe('la cabecera', () => {
	test('es la de la librería, con la sección arriba y el título grande', async () => {
		wrapper = await mountView();

		const header = wrapper.findComponent(PageHeader);
		expect(header.props('eyebrow')).toBe('views.gallery.section');
		expect(header.props('title')).toBe('views.gallery.title');
		expect(header.props('size')).toBe('lg');
	});

	test('los filtros son botones de la librería con iconos del tema y sin emojis', async () => {
		wrapper = await mountView();

		const icons = wrapper
			.findComponent(PageHeader)
			.findAllComponents(ActionButton)
			.map((b) => b.props('icon'));
		expect(icons).toEqual(['view-refresh', 'view-grid', 'image-x-generic', 'video-x-generic', 'x-office-calendar']);
		expect(wrapper.findComponent(PageHeader).text()).not.toMatch(/[🔄📋🖼🎬]/u);
	});
});

describe('la línea de tiempo en una ventana angosta', () => {
	test('al lado de la grilla sólo desde 30 rem de ventana', async () => {
		wrapper = await mountView();

		const docked = wrapper.find('[data-timeline-docked]');
		expect(docked.classes()).toEqual(expect.arrayContaining(['hidden', '@min-[30rem]/window:flex']));
		expect(wrapper.classes()).toContain('@container/window');
	});

	test('el botón para abrirla sólo aparece por debajo de ese ancho', async () => {
		wrapper = await mountView();

		expect(toggle(wrapper)?.classes()).toContain('@min-[30rem]/window:hidden');
		expect(toggle(wrapper)?.props('pressed')).toBe(false);
	});

	test('el botón la abre encima de la grilla, desplegada', async () => {
		wrapper = await mountView();
		expect(wrapper.find('[data-timeline-overlay]').exists()).toBe(false);

		await toggle(wrapper)?.trigger('click');

		const overlay = wrapper.find('[data-timeline-overlay]');
		expect(overlay.exists()).toBe(true);
		expect(overlay.classes()).toContain('@min-[30rem]/window:hidden');
		expect(overlay.findComponent(TimelineSidebar).props('alwaysExpanded')).toBe(true);
		expect(toggle(wrapper)?.props('pressed')).toBe(true);
	});

	test('elegir un mes la cierra, y el botón también', async () => {
		wrapper = await mountView();

		await toggle(wrapper)?.trigger('click');
		wrapper.find('[data-timeline-overlay]').findComponent(TimelineSidebar).vm.$emit('jump', '2026-09');
		await flushPromises();

		expect(wrapper.find('[data-timeline-overlay]').exists()).toBe(false);

		await toggle(wrapper)?.trigger('click');
		await toggle(wrapper)?.trigger('click');

		expect(wrapper.find('[data-timeline-overlay]').exists()).toBe(false);
	});
});
