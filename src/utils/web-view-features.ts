/**
 * El motor del navegador trae su propio menú de clic derecho («Recargar»,
 * «Inspeccionar») y su propio atajo de búsqueda. Ninguno de los dos pertenece a
 * una aplicación de escritorio: ofrecen acciones que no significan nada acá y
 * delatan que abajo hay un navegador. Se apagan para que en su lugar aparezca
 * el menú propio de VasakOS.
 */

export interface WebViewFeatureOptions {
	/**
	 * Bloquear Ctrl+F. Conviene en las aplicaciones donde no significa nada,
	 * pero no en el terminal: ahí la combinación es de la consola (avanzar un
	 * caracter en readline) y tiene que llegar al programa que corre adentro.
	 */
	blockNativeFind?: boolean;
}

function disableContextMenu() {
	document.addEventListener('contextmenu', (event) => {
		event.preventDefault();
	});
}

function disableNativeFind() {
	document.addEventListener(
		'keydown',
		(event) => {
			const isCtrlOrCmd = event.ctrlKey || event.metaKey;

			if (isCtrlOrCmd && event.key === 'f') {
				event.preventDefault();
			}
		},
		{ capture: true }
	);
}

export function disableWebViewFeatures({ blockNativeFind = true }: WebViewFeatureOptions = {}) {
	disableContextMenu();

	if (blockNativeFind) {
		disableNativeFind();
	}
}
