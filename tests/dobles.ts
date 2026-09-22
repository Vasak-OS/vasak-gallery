/**
 * Los dobles de lo que sólo existe adentro de la ventana de Tauri.
 *
 * Sin ellos, importar el layout falla en la primera línea: el marco pide
 * iconos, escucha el cambio de tema y lee la configuración del escritorio.
 */

export const laVentanaRecibio: string[] = [];

export function getCurrentWindow() {
	return {
		minimize: async () => void laVentanaRecibio.push('minimize'),
		toggleMaximize: async () => void laVentanaRecibio.push('toggleMaximize'),
		close: async () => void laVentanaRecibio.push('close'),
	};
}

/**
 * El `t()` devuelve la clave: una prueba que mire el texto mira la clave.
 *
 * Salvo las que se registren con `ponerTraduccion`, que es para lo que se
 * arma con `.replace('{0}', …)`: ahí lo que hay que comprobar es que el dato
 * llegue al texto, y con la clave cruda no hay dónde meterlo.
 */
const traducciones = new Map<string, string>();

export function ponerTraduccion(clave: string, texto: string) {
	traducciones.set(clave, texto);
}

export function useI18n() {
	return {
		t: (clave: string) => traducciones.get(clave) ?? clave,
		locale: { value: 'es' },
	};
}

/** Lo que el marco lee para saber de qué lado va la barra. */
let configuracion: Record<string, unknown> = {};

export function ponerLaConfiguracion(nueva: Record<string, unknown>) {
	configuracion = nueva;
}

export async function readConfig() {
	return configuracion;
}

export function useConfigStore() {
	return { config: configuracion, loadConfig: async () => {} };
}

/**
 * La ruta de un archivo local como la sirve el protocolo de Tauri.
 *
 * El prefijo no es el real —lo arma Tauri con el identificador de la ventana—,
 * pero lo que las pruebas miran es que la ruta *pase por acá*: cargarla cruda la
 * bloquea la política de contenido.
 */
export function convertFileSrc(ruta: string) {
	return `asset://localhost/${encodeURIComponent(ruta)}`;
}

/**
 * Lo que responde cada comando del backend.
 *
 * Sin esto `invoke` devolvía `undefined` para todo, y la grilla terminaba
 * siempre en el estado de error: `get_all_media` devuelve una lista y el
 * componente la recorre. Con el registro, una prueba puede pedir la grilla
 * vacía, la grilla llena o el error, que son justo los tres estados que ahora
 * dibuja la librería.
 */
const respuestas = new Map<string, unknown>();

export function responderInvoke(comando: string, valor: unknown) {
	respuestas.set(comando, valor);
}

export async function invoke(comando: string) {
	const respuesta = respuestas.get(comando);
	if (respuesta instanceof Error) throw respuesta;
	// Una promesa registrada se devuelve tal cual: registrar una que no se
	// resuelve nunca es cómo una prueba deja la vista parada en «cargando».
	return respuesta;
}

/** Abrir con el programa del sistema, que en una prueba no abre nada. */
export async function open(_ruta: string) {}

export async function writeConfig(_clave: string, _valor: unknown) {}

/** El menú del escritorio: acá sólo importa que no reviente al importarse. */
export function useContextMenu() {
	return { showMenu: async () => {} };
}

/** Los oyentes registrados por evento, para poder dispararlos desde una prueba. */
const listeners = new Map<string, Set<(evento: { payload: unknown }) => unknown>>();

export async function listen(nombre: string, manejador: (evento: { payload: unknown }) => unknown) {
	const suyos = listeners.get(nombre) ?? new Set();
	suyos.add(manejador);
	listeners.set(nombre, suyos);
	return () => {
		suyos.delete(manejador);
	};
}

/** Dispara un evento del backend y espera a que lo atiendan. */
export async function emit(nombre: string, payload: unknown = null) {
	for (const manejador of [...(listeners.get(nombre) ?? [])]) {
		await manejador({ payload });
	}
}

/**
 * Lo que el tema contesta para un nombre, cuando la prueba lo dice.
 *
 * Devolvían una ruta fija, con lo cual el icono se dibujaba pero no se podía
 * comprobar **cuál** era ni si había cambiado: un cambio de tema salía
 * indistinguible de ninguno.
 */
const themeIcons = new Map<string, string>();

/** Pone —o cambia— lo que el tema devuelve para un nombre. */
export function setThemeIcon(nombre: string, fuente: string) {
	themeIcons.set(nombre, fuente);
}

export async function getIconSource(nombre: string) {
	return themeIcons.get(nombre) ?? 'icono.png';
}

export async function getSymbolSource(nombre: string) {
	return themeIcons.get(nombre) ?? 'simbolo.png';
}

export function olvidarTodo() {
	laVentanaRecibio.length = 0;
	configuracion = {};
	respuestas.clear();
	traducciones.clear();
	listeners.clear();
	themeIcons.clear();
}
