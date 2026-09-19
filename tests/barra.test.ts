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
import { AppBar, WindowControls, WindowFrame } from '@vasakgroup/vue-libvasak';
import { mount, type VueWrapper } from '@vue/test-utils';
import { h } from 'vue';
import NotificationToast from '@/components/ui/NotificationToast.vue';
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
});

describe('la ventana', () => {
	test('usa el marco compartido', () => {
		expect(abrir().findComponent(WindowFrame).exists()).toBe(true);
	});

	test('y no queda un segundo borde dibujado a mano', () => {
		expect(abrir().findAll('.rounded-corner-window').length).toBe(1);
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
	test('el icono va en `identidad`', () => {
		// En el contenido de la barra se desplazaría con lo demás cuando queda a
		// un costado: `identidad` es la única zona que no scrollea.
		const dentro = ranura(abrir(), 'identidad');

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

	test('y los avisos siguen colgando de la ventana', () => {
		// `NotificationToast` va **dentro** del marco y no al lado: fuera de él
		// se apoyaría en el documento, que con la ventana redondeada le
		// pintaría las esquinas. Al envolver todo en el marco es justo lo que se
		// puede quedar afuera sin que nada se rompa.
		const ventana = abrir();
		const marco = ventana.findComponent(WindowFrame).element;
		const aviso = ventana.findComponent(NotificationToast).element;

		expect(marco.contains(aviso)).toBe(true);
	});
});
