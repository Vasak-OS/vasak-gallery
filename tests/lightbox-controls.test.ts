/**
 * Los controles del visor y la cabecera de cada mes, con las piezas de la
 * librería (vue-libvasak 2.2, estilo Once UI).
 *
 * El escenario del visor —la foto, el zoom, el arrastre— es propio (§5 del
 * inventario de vue-libvasak#74); lo que pasa a la librería son los botones y
 * las pastillas que van encima: `ActionButton` y `Badge` con la variante
 * `overlay`, la barra de tiempo `SeekBar`, el volumen `Slider` y el vacío del
 * vídeo que no se puede reproducir, `EmptyState`. Antes eran siete SVG propios
 * y veinticinco colores escritos a mano.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import {
	ActionButton,
	Badge,
	EmptyState,
	olvidarLosIconosDelTema,
	SectionHeading,
	SeekBar,
	Slider,
} from '@vasakgroup/vue-libvasak';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ImageGrid from '@/components/ImageGrid.vue';
import Lightbox from '@/components/Lightbox.vue';
import type { MediaItem } from '@/types/gallery';
import { olvidarTodo, responderInvoke } from './dobles';

function makeItem(id: number, mediaType: MediaItem['media_type'] = 'image'): MediaItem {
	const ext = mediaType === 'video' ? 'webm' : 'png';
	return {
		id,
		original_path: `/home/pato/Imágenes/item-${id}.${ext}`,
		thumbnail_path: `/home/pato/.cache/vasak-gallery/item-${id}.png`,
		media_type: mediaType,
		created_at: '2026-09-01T10:00:00Z',
		file_size: 1024,
	};
}

/** El visor se teletransporta al `body`: se desmonta a mano pase lo que pase. */
const mounted = new Set<VueWrapper>();

afterEach(() => {
	for (const wrapper of mounted) wrapper.unmount();
	mounted.clear();
	for (const leftover of document.body.querySelectorAll('[role="dialog"]')) {
		leftover.parentElement?.remove();
	}
	olvidarTodo();
	olvidarLosIconosDelTema();
});

async function openViewer(current: MediaItem, items: MediaItem[]) {
	const wrapper = mount(Lightbox, {
		props: { isOpen: true, currentItem: current, items },
		attachTo: document.body,
	});
	mounted.add(wrapper);
	await nextTick();
	return wrapper;
}

const panel = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

describe('los botones del visor', () => {
	test('son los de la librería, sobre la imagen, con el icono del tema', async () => {
		const items = [makeItem(1), makeItem(2), makeItem(3)];
		const wrapper = await openViewer(items[1] as MediaItem, items);

		const buttons = wrapper.findAllComponents(ActionButton);
		expect(buttons.map((b) => b.props('icon'))).toEqual(['window-close', 'go-previous', 'go-next']);
		expect(buttons.every((b) => b.props('variant') === 'overlay')).toBe(true);
	});

	test('cada uno tiene nombre, aunque sólo muestre el icono', async () => {
		const items = [makeItem(1), makeItem(2), makeItem(3)];
		await openViewer(items[1] as MediaItem, items);

		const names = [...(panel()?.querySelectorAll('button[aria-label]') ?? [])].map((b) =>
			b.getAttribute('aria-label')
		);
		expect(names).toEqual([
			'components.lightbox.close',
			'components.lightbox.prev',
			'components.lightbox.next',
		]);
	});

	test('cerrar avisa a quien lo abrió', async () => {
		const items = [makeItem(1), makeItem(2)];
		const wrapper = await openViewer(items[0] as MediaItem, items);

		await wrapper.findAllComponents(ActionButton)[0]?.trigger('click');

		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	test('ni un SVG propio ni un color escrito a mano', async () => {
		const items = [makeItem(1), makeItem(2), makeItem(3)];
		await openViewer(items[1] as MediaItem, items);

		const html = panel()?.outerHTML ?? '';
		expect(html).not.toContain('<svg');
		expect(html).not.toMatch(/(?:bg|text|border)-(?:white|black)/);
		expect(html).not.toContain('backdrop-blur');
	});
});

describe('las pastillas sobre la imagen', () => {
	test('el contador y el nombre van en fila y no uno encima del otro', async () => {
		// Estaban los dos en `left-4 top-4`: con una foto abierta, el nombre
		// tapaba el contador entero.
		const items = [makeItem(1), makeItem(2), makeItem(3)];
		await openViewer(items[1] as MediaItem, items);

		const counter = panel()?.querySelector('[data-counter]');
		const fileName = panel()?.querySelector('[data-file-name]');
		expect(counter?.textContent?.trim()).toBe('2 / 3');
		expect(fileName?.textContent?.trim()).toBe('item-2.png');
		expect(counter?.parentElement).toBe(fileName?.parentElement ?? null);
		expect(counter?.className).not.toContain('absolute');
		expect(fileName?.className).not.toContain('absolute');
	});

	test('son insignias de la librería con el velo sobre medios', async () => {
		const items = [makeItem(1), makeItem(2)];
		const wrapper = await openViewer(items[0] as MediaItem, items);

		const badges = wrapper.findAllComponents(Badge);
		expect(badges.length).toBeGreaterThanOrEqual(3);
		expect(badges.every((b) => b.props('variant') === 'overlay')).toBe(true);
	});
});

describe('el reproductor de vídeo', () => {
	function videoOf(): HTMLVideoElement {
		const video = panel()?.querySelector('video');
		if (!video) throw new Error('no hay vídeo');
		return video;
	}

	test('reproducir y silenciar son botones de la librería con iconos del tema', async () => {
		const items = [makeItem(1, 'video')];
		const wrapper = await openViewer(items[0] as MediaItem, items);

		const icons = wrapper.findAllComponents(ActionButton).map((b) => b.props('icon'));
		expect(icons).toContain('media-playback-start');
		expect(icons).toContain('audio-volume-muted');
	});

	test('el icono del sonido sigue al estado', async () => {
		const items = [makeItem(1, 'video')];
		const wrapper = await openViewer(items[0] as MediaItem, items);
		const mute = () => wrapper.findAllComponents(ActionButton).find((b) => b.props('icon')?.startsWith('audio-'));

		await mute()?.trigger('click');

		expect(videoOf().muted).toBe(false);
		expect(mute()?.props('icon')).toBe('audio-volume-high');
	});

	test('el volumen es el deslizador de la librería, con nombre y valor que se oye', async () => {
		const items = [makeItem(1, 'video')];
		const wrapper = await openViewer(items[0] as MediaItem, items);

		const slider = wrapper.findComponent(Slider);
		expect(slider.props('label')).toBe('components.lightbox.volume');
		expect(slider.find('input').attributes('aria-valuetext')).toBe('100 %');

		slider.vm.$emit('update:modelValue', 0.4);
		await nextTick();

		expect(videoOf().volume).toBeCloseTo(0.4);
		expect(wrapper.findComponent(Slider).props('modelValue')).toBeCloseTo(0.4);
	});

	test('la barra de tiempo salta a donde se suelta', async () => {
		const items = [makeItem(1, 'video')];
		const wrapper = await openViewer(items[0] as MediaItem, items);
		const video = videoOf();
		Object.defineProperty(video, 'duration', { configurable: true, value: 30 });
		video.dispatchEvent(new Event('loadedmetadata'));
		await nextTick();

		const bar = wrapper.findComponent(SeekBar);
		expect(bar.props('duration')).toBe(30);
		expect(bar.props('label')).toBe('components.lightbox.seek');

		bar.vm.$emit('seek', 12);
		await nextTick();

		expect(video.currentTime).toBe(12);
		expect(wrapper.findComponent(SeekBar).props('position')).toBe(12);
	});

	test('si no se puede reproducir, lo dice con el vacío del sistema y sin emoji', async () => {
		const items = [makeItem(1, 'video')];
		const wrapper = await openViewer(items[0] as MediaItem, items);
		const video = videoOf();
		Object.defineProperty(video, 'error', { configurable: true, value: { code: 4 } });
		video.dispatchEvent(new Event('error'));
		await nextTick();

		const empty = wrapper.findComponent(EmptyState);
		expect(empty.props('icon')).toBe('video-x-generic');
		expect(empty.props('title')).toBe('components.lightbox.videoUnsupported');
		expect(empty.props('note')).toBe('components.lightbox.videoErrors.format');
		expect(panel()?.textContent).not.toContain('🎬');
		expect(
			wrapper.findAllComponents(ActionButton).some((b) => b.props('label') === 'components.lightbox.openWithSystem')
		).toBe(true);
	});
});

describe('la cabecera de cada mes', () => {
	test('es el encabezado de sección de la librería, pegado arriba y con el contador', async () => {
		responderInvoke('get_all_media', [makeItem(1), makeItem(2)]);
		const wrapper = mount(ImageGrid, { props: { autoScan: false } });
		mounted.add(wrapper);
		await flushPromises();

		const heading = wrapper.findComponent(SectionHeading);
		expect(heading.props('sticky')).toBe(true);
		expect(heading.props('divider')).toBe(true);
		expect(heading.props('count')).toBe(2);
		expect(heading.props('as')).toBe('h2');
		expect(wrapper.html()).not.toContain('backdrop-blur');
	});

	test('el relleno de la grilla depende del contenedor, no de la pantalla', async () => {
		responderInvoke('get_all_media', [makeItem(1)]);
		const wrapper = mount(ImageGrid, { props: { autoScan: false } });
		mounted.add(wrapper);
		await flushPromises();

		expect(wrapper.classes()).toContain('@container');
		expect(wrapper.html()).not.toMatch(/\ssm:p-3/);
	});
});
