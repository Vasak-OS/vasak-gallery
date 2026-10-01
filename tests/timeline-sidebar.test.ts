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
import { Tooltip } from '@vasakgroup/vue-libvasak';
import TimelineSidebar from '@/components/TimelineSidebar.vue';
import type { TimelineEntry } from '@/types/gallery';
import { ponerTraduccion } from './dobles';

const MONTHS: TimelineEntry[] = [
	{ key: '2026-09', year: 2026, month: 9, count: 42 },
	{ key: '2026-08', year: 2026, month: 8, count: 7 },
	{ key: '2025-12', year: 2025, month: 12, count: 3 },
];

let wrapper: VueWrapper | null = null;

beforeEach(() => {
	ponerTraduccion('components.timeline.label', 'Línea de tiempo');
	ponerTraduccion('components.timeline.monthLabel', '{0} de {1}, {2} elementos');
	ponerTraduccion('months.long.september', 'Septiembre');
	ponerTraduccion('months.short.september', 'Sep');
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

function mountRail(activeKey: string | null = null) {
	return mount(TimelineSidebar, { props: { entries: MONTHS, activeKey } });
}

describe('la línea de tiempo con el teclado', () => {
	test('cada mes es un botón, así que el Tab lo alcanza', () => {
		wrapper = mountRail();

		expect(wrapper.findAll('button')).toHaveLength(MONTHS.length);
	});

	test('activar un mes avisa a quién corresponde', async () => {
		// Con un `<button>`, Enter y la barra espaciadora disparan `click` sin
		// que haya que escribir nada: es la mitad del motivo para usarlo.
		wrapper = mountRail();

		await wrapper.findAll('button')[0].trigger('click');

		expect(wrapper.emitted('jump')).toEqual([['2026-09']]);
	});

	test('el nombre dice el mes, el año y cuántos hay', () => {
		// Lo que se ve es «Sep 42», que fuera de contexto no dice de qué año es
		// ni de qué son esos 42.
		wrapper = mountRail();

		expect(wrapper.findAll('button')[0].attributes('aria-label')).toBe(
			'Septiembre de 2026, 42 elementos',
		);
	});

	test('el mes actual se anuncia como actual y no sólo con el color', () => {
		wrapper = mountRail('2026-09');
		const buttons = wrapper.findAll('button');

		expect(buttons[0].attributes('aria-current')).toBe('true');
		expect(buttons[1].attributes('aria-current')).toBeUndefined();
	});

	test('la barra tiene nombre, para poder saltar a ella', () => {
		wrapper = mountRail();

		expect(wrapper.find('nav').attributes('aria-label')).toBe('Línea de tiempo');
	});

	test('los años son encabezados', () => {
		wrapper = mountRail();

		expect(wrapper.findAll('h2').map((h) => h.text())).toEqual(['2026', '2025']);
	});
});

describe('desplegarse', () => {
	test('con el foco también, y no sólo con el ratón', async () => {
		// El defecto que quedaba aunque el Tab llegara: el `aside` se abría con
		// `@mouseenter`, así que con el teclado las etiquetas seguían en
		// `opacity-0` y no había forma de saber a qué mes se había llegado.
		wrapper = mountRail();
		const label = () => wrapper?.findAll('button')[0].find('span');

		expect(label()?.classes()).toContain('opacity-0');

		await wrapper.find('nav').trigger('focusin');

		expect(label()?.classes()).toContain('opacity-100');
		expect(label()?.classes()).not.toContain('opacity-0');
	});

	test('al irse el foco se vuelve a cerrar', async () => {
		wrapper = mountRail();

		await wrapper.find('nav').trigger('focusin');
		await wrapper.find('nav').trigger('focusout');

		expect(wrapper.findAll('button')[0].find('span').classes()).toContain('opacity-0');
	});
});

describe('el globo de cada mes', () => {
	test('es el Tooltip de la librería, uno por mes', () => {
		// Era un `div` con una flecha dibujada con dos bordes; ahora la forma,
		// la superficie flotante y la posición son las de la librería.
		wrapper = mountRail();

		expect(wrapper.findAllComponents(Tooltip)).toHaveLength(MONTHS.length);
	});

	test('dice el mes, el año y cuántos hay', () => {
		wrapper = mountRail();

		expect(document.body.textContent).toContain('Sep 2026');
		expect(document.body.textContent).toContain('42');
	});

	test('se apaga con la barra desplegada, que ya muestra lo mismo', async () => {
		wrapper = mountRail();
		const disabled = () => wrapper?.findAllComponents(Tooltip).map((tip) => tip.props('disabled'));

		expect(disabled()).toEqual([false, false, false]);

		await wrapper.find('nav').trigger('focusin');

		expect(disabled()).toEqual([true, true, true]);
	});
});

describe('abierta a propósito', () => {
	test('con `alwaysExpanded` muestra los meses sin esperar al ratón ni al foco', () => {
		// Es la barra que se abre encima de la grilla en una ventana angosta:
		// la columna de puntos ahí no le serviría a nadie.
		wrapper = mount(TimelineSidebar, { props: { entries: MONTHS, activeKey: null, alwaysExpanded: true } });

		expect(wrapper.findAll('button')[0].find('span').classes()).toContain('opacity-100');
		expect(wrapper.find('nav').classes()).toContain('w-28');
	});
});
