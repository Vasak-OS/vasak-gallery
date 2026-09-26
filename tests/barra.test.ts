/**
 * La barra de la ventana de la galería.
 *
 * Tenía su propio marco y su propia barra, con el nombre centrado a fuerza de
 * un tercer `span` vacío que empujaba contra el `justify-between`. Los dos
 * salen ahora de la librería, y el nombre va en la ranura `centro`.
 *
 * Lo que se comprueba es dónde queda cada cosa, que es lo que se rompe al
 * mudarla: una ranura mal conectada no da ningún error, lo que se le ponga
 * desaparece en silencio.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import {
	AppBar,
	olvidarLosIconosDelTema,
	ToastArea,
	WindowControls,
	WindowFrame,
} from '@vasakgroup/vue-libvasak';
import { mount, type VueWrapper } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import WindowAppLayout from '@/layouts/WindowAppLayout.vue';
import { olvidarTodo } from './dobles';

let vista: VueWrapper | null = null;
/** Lo que cada llamada a `ranura()` dejó montado, para desmontarlo después. */
const sueltos: VueWrapper[] = [];

/** La ventana, con un router de mentira: el layout dibuja un `RouterView`. */
function abrir() {
	vista = mount(WindowAppLayout, {
		global: { stubs: { RouterView: { render: () => h('div', { class: 'vista' }) } } },
	});
	return vista;
}

/**
 * Lo que se dibuja dentro de una ranura de la barra.
 *
 * Lo que monta **no** cuelga de `vista`, así que no se va con ella: se anota y
 * el `afterEach` lo desmonta.
 */
function ranura(ventana: VueWrapper, nombre: string) {
	const barra = ventana.findComponent(AppBar);
	const dibujar = (barra.vm.$slots as Record<string, (() => unknown) | undefined>)[nombre];
	if (!dibujar) return null;
	const suelto = mount({ render: () => dibujar() });
	sueltos.push(suelto);
	return suelto;
}

afterEach(() => {
	for (const suelto of sueltos.splice(0)) suelto.unmount();
	vista?.unmount();
	vista = null;
	olvidarTodo();
	// Lo que el tema resolvió se memoriza en el módulo de la librería, y un
	// módulo se comparte entre archivos de prueba: sin vaciarlo, el primero que
	// pida un icono sin tema preparado deja guardado que no hay ninguno.
	olvidarLosIconosDelTema();
});

describe('la ventana', () => {
	test('usa el marco compartido', () => {
		expect(abrir().findComponent(WindowFrame).exists()).toBe(true);
	});

	test('y no queda un segundo borde dibujado a mano', () => {
		expect(abrir().findAll('.rounded-corner-window')).toHaveLength(1);
	});

	test('con los tres botones y su nombre traducido', () => {
		// Sin las etiquetas salen en inglés, que son los valores por omisión de
		// la librería. Es el nombre accesible: lo único que lo dice es el lector
		// de pantalla, así que nadie lo ve al mirar la ventana.
		expect(
			abrir()
				.findComponent(WindowControls)
				.findAll('button')
				.map((boton) => boton.attributes('aria-label'))
		).toEqual(['windowControls.minimize', 'windowControls.maximize', 'windowControls.close']);
	});
});

describe('lo que va en la barra', () => {
	test('el icono va en `identidad`', async () => {
		// En el contenido de la barra se desplazaría con lo demás cuando queda a
		// un costado: `identidad` es la única zona que no scrollea.
		//
		// El icono lo dibuja `ThemeIcon`, que lo resuelve contra el tema: hasta
		// que vuelve deja un hueco del tamaño del icono y no un `img`.
		const dentro = ranura(abrir(), 'identidad');
		await new Promise((listo) => setTimeout(listo, 0));
		await nextTick();

		expect(dentro?.find('img').attributes('alt')).toBe('views.app.iconAlt');
	});

	test('el nombre va en `centro`, al medio de la ventana entera', () => {
		// Antes lo centraba un tercer `span` vacío tirando contra el
		// `justify-between`, y eso lo deja centrado respecto de lo que sobra
		// entre el icono y los controles: los tres botones ocupan bastante más
		// que el icono, así que se corría.
		const dentro = ranura(abrir(), 'centro');

		expect(dentro?.text()).toBe('views.app.title');
	});

	test('y el molde viejo no dejó nada suelto en el contenido de la barra', () => {
		// El icono, el nombre y un `<span></span>` vacío eran los tres hijos que
		// el `justify-between` necesitaba. Los dos primeros tienen su ranura, y
		// el tercero no tiene por qué existir.
		const dentro = ranura(abrir(), 'default');

		expect(dentro?.text()).toBe('');
	});
});

describe('el contenido', () => {
	test('la vista de la ruta se dibuja dentro de la ventana', () => {
		expect(abrir().find('.vista').exists()).toBe(true);
	});

	test('y la pila de avisos es la de la librería, apilando abajo al centro', () => {
		// Abajo al centro y no en la esquina, que es lo que la librería hace por
		// omisión: en una ventana de ver fotos, la esquina compite con los
		// controles del visor. Si la posición no llegara, los avisos se mudarían
		// de lugar sin que nada falle.
		const pila = abrir().findComponent(ToastArea);

		expect(pila.exists()).toBe(true);
		expect(pila.props('position')).toBe('bottom-center');
	});
});
