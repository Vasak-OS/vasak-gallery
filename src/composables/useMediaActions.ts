import { invoke } from '@tauri-apps/api/core';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { readConfig, type VSKConfig, writeConfig } from '@vasakgroup/plugin-config-manager';
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { useNotification } from '@/composables/useNotification';
import type { MediaItem } from '@/types/gallery';

/**
 * Lo que se puede hacer con una foto o un video desde el menú contextual.
 *
 * Vive acá y no en un componente porque el mismo menú aparece en dos lugares:
 * sobre las miniaturas de la grilla y sobre la imagen abierta a pantalla
 * completa.
 */
export function useMediaActions() {
	const { notify } = useNotification();
	const { t } = useI18n();

	/** La carpeta que contiene el archivo, para abrirla en el gestor de archivos. */
	function parentDirectory(path: string): string {
		const index = path.lastIndexOf('/');
		return index > 0 ? path.slice(0, index) : '/';
	}

	async function openWithSystem(item: MediaItem) {
		try {
			await shellOpen(item.original_path);
		} catch (error) {
			notify(t('notifications.openError').replace('{0}', String(error)), 'error');
		}
	}

	async function showInFileManager(item: MediaItem) {
		try {
			await shellOpen(parentDirectory(item.original_path));
		} catch (error) {
			notify(t('notifications.openError').replace('{0}', String(error)), 'error');
		}
	}

	async function copyImage(item: MediaItem) {
		try {
			await invoke('clipboard_copy_image', { path: item.original_path });
			notify(t('notifications.copiedImage'));
		} catch (error) {
			notify(t('notifications.copyError').replace('{0}', String(error)), 'error');
		}
	}

	async function copyPath(item: MediaItem) {
		try {
			await invoke('clipboard_copy_text', { text: item.original_path });
			notify(t('notifications.copiedPath'));
		} catch (error) {
			notify(t('notifications.copyError').replace('{0}', String(error)), 'error');
		}
	}

	/**
	 * El fondo de escritorio se guarda en la configuración del sistema, que es
	 * de donde lo lee el escritorio: no hay nada más que hacer después de
	 * escribirlo.
	 */
	async function setAsWallpaper(item: MediaItem) {
		try {
			const config: VSKConfig | null = await readConfig();
			if (!config) {
				throw new Error('empty configuration');
			}

			config.desktop = {
				...config.desktop,
				wallpaper: [item.original_path],
			};

			await writeConfig(config);
			notify(t('notifications.wallpaperSet'));
		} catch (error) {
			notify(t('notifications.wallpaperError').replace('{0}', String(error)), 'error');
		}
	}

	return {
		openWithSystem,
		showInFileManager,
		copyImage,
		copyPath,
		setAsWallpaper,
	};
}
