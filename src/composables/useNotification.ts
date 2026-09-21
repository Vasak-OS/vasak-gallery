import type { AvisoTransitorio } from '@vasakgroup/vue-libvasak';
import { ref } from 'vue';

/**
 * Avisos breves, para que las acciones del menú contextual digan si salieron
 * bien. Copiar una imagen o cambiar el fondo de escritorio no dejan ninguna
 * huella en la pantalla: sin un aviso, quien lo hace no sabe si pasó algo.
 *
 * La **cola** es de acá —cuándo aparece, cuánto dura y cuándo se va— y el
 * dibujo es de `ToastArea`. Es el reparto que hace la librería: lo que se ve y
 * lo que oye un lector de pantalla son del sistema, para que un aviso de la
 * galería y uno del gestor de archivos se sientan lo mismo; cuándo aparece lo
 * decide cada aplicación, y eso ya estaba resuelto acá.
 */
const notifications = ref<AvisoTransitorio[]>([]);
let nextId = 0;

export function useNotification() {
	function notify(
		message: string,
		tone: AvisoTransitorio['tone'] = 'success',
		timeout = 2500
	) {
		const id = nextId++;
		notifications.value.push({ id, message, tone });
		setTimeout(() => {
			const index = notifications.value.findIndex((notification) => notification.id === id);
			if (index !== -1) {
				notifications.value.splice(index, 1);
			}
		}, timeout);
	}

	return { notifications, notify };
}
