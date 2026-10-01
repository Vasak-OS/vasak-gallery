/**
 * La tarjeta de cada foto en la grilla.
 *
 * Desde vue-libvasak 2.2 sus piezas son de la librería: las insignias de tipo
 * (`Badge variant="overlay"`), el lugar mientras carga (`Skeleton`) y el icono
 * del vídeo, que era un 🎬 escrito y ahora sale del tema. Lo propio es la
 * tarjeta: la miniatura, el nombre y la fecha.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { mount, type VueWrapper } from '@vue/test-utils';
import { Badge, Skeleton, ThemeIcon } from '@vasakgroup/vue-libvasak';
import MediaCard from '@/components/ui/MediaCard.vue';
import type { MediaItem } from '@/types/gallery';

let wrapper: VueWrapper | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

/** Lo mínimo que la tarjeta necesita para dibujarse. */
const anItem: MediaItem = {
	id: 7,
	original_path: '/home/pato/Imágenes/a.jpg',
	thumbnail_path: '/home/pato/.cache/vasak-gallery/a.jpg',
	media_type: 'image',
	created_at: '2026-09-20T00:00:00Z',
	file_size: 1024,
};

function mountCard(item: Partial<MediaItem> = {}) {
	return mount(MediaCard, { props: { item: { ...anItem, ...item } } });
}

describe('MediaCard', () => {
	test('se marca sola con el id, que es lo que busca la rejilla', () => {
		// La rejilla hace `closest('[data-media-id]')` para saber sobre cuál se
		// hizo clic derecho. Antes se lo pasaba desde afuera y llegaba acá por
		// caída de atributos; ahora la tarjeta lo pone en su propia raíz.
		wrapper = mountCard();

		expect(wrapper.find('button').attributes('data-media-id')).toBe('7');
	});

	test('y el clic llega con el elemento', async () => {
		wrapper = mountCard();

		await wrapper.find('button').trigger('click');

		expect(wrapper.emitted('click')?.[0]).toEqual([anItem]);
	});

	test('ya no sube al pasar el ratón', () => {
		// Once UI no mueve nada al pasar por encima: reacciona el velo.
		wrapper = mountCard();

		expect(wrapper.find('button').classes().some((c) => c.includes('translate'))).toBe(false);
	});

	test('mientras carga muestra el esqueleto de la librería', async () => {
		wrapper = mountCard();

		expect(wrapper.findComponent(Skeleton).exists()).toBe(true);

		await wrapper.find('img').trigger('load');

		expect(wrapper.findComponent(Skeleton).exists()).toBe(false);
	});

	test('una imagen común no lleva insignia', () => {
		wrapper = mountCard();

		expect(wrapper.findAllComponents(Badge)).toHaveLength(0);
	});

	test('el vídeo se marca con el icono del tema y no con un emoji', () => {
		wrapper = mountCard({ media_type: 'video', original_path: '/home/pato/Videos/a.webm' });

		const badge = wrapper.findComponent(Badge);
		expect(badge.props('variant')).toBe('overlay');
		expect(badge.findComponent(ThemeIcon).props('name')).toBe('video-x-generic');
		// Lleva nombre: es lo único que dice que es un vídeo.
		expect(badge.findComponent(ThemeIcon).props('alt')).toBe('components.mediaCard.video');
		expect(wrapper.text()).not.toContain('🎬');
	});

	test('un GIF lleva su insignia fija y la de tipo, las dos sobre la imagen', () => {
		wrapper = mountCard({ original_path: '/home/pato/Imágenes/a.gif' });

		const badges = wrapper.findAllComponents(Badge);
		expect(badges.map((b) => b.props('variant'))).toEqual(['overlay', 'overlay']);
		expect(badges.map((b) => b.text())).toEqual(['GIF', 'gif']);
	});

	test('si la miniatura no carga lo dice en una insignia', async () => {
		wrapper = mountCard();

		await wrapper.find('img').trigger('error');

		expect(wrapper.findComponent(Badge).text()).toBe('components.mediaCard.loadError');
		expect(wrapper.findComponent(Skeleton).exists()).toBe(false);
	});
});
