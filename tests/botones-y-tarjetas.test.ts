/**
 * Los componentes que ahora **declaran** lo que emiten.
 *
 * `AppButton` no declaraba `click`: el `@click` de quien lo usaba caía sobre el
 * `<button>` de adentro por el paso de atributos. Funcionaba, pero no estaba
 * escrito en ningún lado —quien lo escribía no tenía forma de saber si
 * llegaba— y con `strictTemplates` pasó a ser un error.
 *
 * Declararlo tiene un filo: Vue saca de los atributos todo evento declarado, así
 * que el `@click="emit('click', $event)"` sobre el `<button>` **no es
 * opcional**. Sin él el botón deja de responder, el chequeo de tipos sigue en
 * cero y nada avisa. Estas pruebas son por eso.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { mount, type VueWrapper } from '@vue/test-utils';
import AppButton from '@/components/ui/AppButton.vue';
import MediaCard from '@/components/ui/MediaCard.vue';
import type { MediaItem } from '@/types/gallery';

let vista: VueWrapper | null = null;

afterEach(() => {
	vista?.unmount();
	vista = null;
});

describe('AppButton', () => {
	test('el clic llega a quien lo usa', async () => {
		vista = mount(AppButton, { slots: { default: 'Reintentar' } });

		await vista.find('button').trigger('click');

		expect(vista.emitted('click')).toHaveLength(1);
	});

	test('y apagado no llega', async () => {
		// Lo garantiza el navegador —un `<button disabled>` no dispara clic—,
		// pero es la razón por la que el emit va sobre el botón y no sobre un
		// envoltorio.
		vista = mount(AppButton, { props: { disabled: true }, slots: { default: 'Reintentar' } });

		await vista.find('button').trigger('click');

		expect(vista.emitted('click')).toBeUndefined();
	});
});

describe('MediaCard', () => {
	/** Lo mínimo que la tarjeta necesita para dibujarse. */
	const unElemento: MediaItem = {
		id: 7,
		original_path: '/home/pato/Imágenes/a.jpg',
		thumbnail_path: '/home/pato/.cache/vasak-gallery/a.jpg',
		media_type: 'image',
		created_at: '2026-09-20T00:00:00Z',
		file_size: 1024,
	};

	test('se marca sola con el id, que es lo que busca la rejilla', () => {
		// La rejilla hace `closest('[data-media-id]')` para saber sobre cuál se
		// hizo clic derecho. Antes se lo pasaba desde afuera y llegaba acá por
		// caída de atributos; ahora la tarjeta lo pone en su propia raíz.
		vista = mount(MediaCard, { props: { item: unElemento } });

		expect(vista.find('button').attributes('data-media-id')).toBe('7');
	});

	test('y el clic llega con el elemento', async () => {
		vista = mount(MediaCard, { props: { item: unElemento } });

		await vista.find('button').trigger('click');

		expect(vista.emitted('click')?.[0]).toEqual([unElemento]);
	});
});
