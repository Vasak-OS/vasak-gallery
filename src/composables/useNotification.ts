import { ref } from 'vue';

/**
 * Avisos breves, para que las acciones del menú contextual digan si salieron
 * bien. Copiar una imagen o cambiar el fondo de escritorio no dejan ninguna
 * huella en la pantalla: sin un aviso, quien lo hace no sabe si pasó algo.
 */
export interface Notification {
	id: number;
	message: string;
	type: 'success' | 'info' | 'error';
}

const notifications = ref<Notification[]>([]);
let nextId = 0;

export function useNotification() {
	function notify(message: string, type: Notification['type'] = 'success', timeout = 2500) {
		const id = nextId++;
		notifications.value.push({ id, message, type });
		setTimeout(() => {
			const index = notifications.value.findIndex((notification) => notification.id === id);
			if (index !== -1) {
				notifications.value.splice(index, 1);
			}
		}, timeout);
	}

	return { notifications, notify };
}
