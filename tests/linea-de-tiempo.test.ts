/**
 * La barra de meses, con el teclado.
 *
 * Era una columna de `div` con `@click`: el Tab no la alcanzaba, Enter no hacía
 * nada, y un lector de pantalla leía el nombre del mes como texto suelto sin
 * decir que se podía activar. Saltar a un mes —la única forma de moverse rápido
 * por una galería grande— sólo se podía con el ratón.
 *
 * Nada de eso fallaba. La galería andaba perfecto con el ratón, que es como se
 * la prueba a mano.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mount, type VueWrapper } from '@vue/test-utils';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { TimelineEntry } from '@/types/gallery';
import { ponerTraduccion } from './dobles';

const MESES: TimelineEntry[] = [
	{ key: '2026-09', year: 2026, month: 9, count: 42 },
	{ key: '2026-08', year: 2026, month: 8, count: 7 },
	{ key: '2025-12', year: 2025, month: 12, count: 3 },
];

let vista: VueWrapper | null = null;

beforeEach(() => {
	ponerTraduccion('components.timeline.label', 'Línea de tiempo');
	ponerTraduccion('components.timeline.monthLabel', '{0} de {1}, {2} elementos');
	ponerTraduccion('months.long.september', 'Septiembre');
	ponerTraduccion('months.short.september', 'Sep');
});

afterEach(() => {
	vista?.unmount();
	vista = null;
});

function montar(activeKey: string | null = null) {
	return mount(TimelineSidebar, { props: { entries: MESES, activeKey } });
}

describe('la línea de tiempo con el teclado', () => {
	test('cada mes es un botón, así que el Tab lo alcanza', () => {
		vista = montar();

		expect(vista.findAll('button')).toHaveLength(MESES.length);
	});

	test('activar un mes avisa a quién corresponde', async () => {
		// Con un `<button>`, Enter y la barra espaciadora disparan `click` sin
		// que haya que escribir nada: es la mitad del motivo para usarlo.
		vista = montar();

		await vista.findAll('button')[0].trigger('click');

		expect(vista.emitted('jump')).toEqual([['2026-09']]);
	});

	test('el nombre dice el mes, el año y cuántos hay', () => {
		// Lo que se ve es «Sep 42», que fuera de contexto no dice de qué año es
		// ni de qué son esos 42.
		vista = montar();

		expect(vista.findAll('button')[0].attributes('aria-label')).toBe(
			'Septiembre de 2026, 42 elementos',
		);
	});

	test('el mes actual se anuncia como actual y no sólo con el color', () => {
		vista = montar('2026-09');
		const botones = vista.findAll('button');

		expect(botones[0].attributes('aria-current')).toBe('true');
		expect(botones[1].attributes('aria-current')).toBeUndefined();
	});

	test('la barra tiene nombre, para poder saltar a ella', () => {
		vista = montar();

		expect(vista.find('nav').attributes('aria-label')).toBe('Línea de tiempo');
	});

	test('los años son encabezados', () => {
		vista = montar();

		expect(vista.findAll('h2').map((h) => h.text())).toEqual(['2026', '2025']);
	});
});

describe('desplegarse', () => {
	test('con el foco también, y no sólo con el ratón', async () => {
		// El defecto que quedaba aunque el Tab llegara: el `aside` se abría con
		// `@mouseenter`, así que con el teclado las etiquetas seguían en
		// `opacity-0` y no había forma de saber a qué mes se había llegado.
		vista = montar();
		const etiqueta = () => vista?.findAll('button')[0].find('span');

		expect(etiqueta()?.classes()).toContain('opacity-0');

		await vista.find('nav').trigger('focusin');

		expect(etiqueta()?.classes()).toContain('opacity-100');
		expect(etiqueta()?.classes()).not.toContain('opacity-0');
	});

	test('al irse el foco se vuelve a cerrar', async () => {
		vista = montar();

		await vista.find('nav').trigger('focusin');
		await vista.find('nav').trigger('focusout');

		expect(vista.findAll('button')[0].find('span').classes()).toContain('opacity-0');
	});
});
