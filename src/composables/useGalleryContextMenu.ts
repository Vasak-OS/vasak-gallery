import { type MenuEntry, useContextMenu } from '@vasakgroup/plugin-vsk-contextual-menu';
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { useMediaActions } from '@/composables/useMediaActions';
import type { FilterType, MediaItem, SortOrder } from '@/types/gallery';

/**
 * Lo que ofrece el clic derecho en la galería.
 *
 * Vive acá y no en un componente porque el mismo menú aparece en dos lugares:
 * sobre las miniaturas de la grilla y sobre la foto abierta a pantalla completa.
 * El dibujo, el teclado y los iconos los pone el menú del escritorio; acá sólo
 * se describe qué opciones hay.
 */
export interface GalleryContextMenuOptions {
	/** Abrir sobra cuando el menú se pide sobre la foto ya abierta. */
	open?: (item: MediaItem) => void;
	/** Sobre el fondo se ofrece recargar y ordenar; sobre la foto abierta, no. */
	reload?: () => void;
	scan?: () => void;
	filter?: (type: FilterType) => void;
	sort?: (order: SortOrder) => void;
	/** Para marcar con una tilde lo que está mostrándose ahora mismo. */
	currentFilter?: () => FilterType;
	currentSort?: () => SortOrder;
}

export function useGalleryContextMenu(options: GalleryContextMenuOptions = {}) {
	const { t } = useI18n();
	const { show } = useContextMenu();
	const actions = useMediaActions();

	function mediaEntries(item: MediaItem): MenuEntry[] {
		// Copiar la imagen y ponerla de fondo sólo tienen sentido con una
		// imagen: de un video no hay nada que copiar al portapapeles, y el fondo
		// de escritorio con video lo prepara el panel de configuración, que sabe
		// recodificarlo.
		const isImage = item.media_type === 'image';
		const entries: MenuEntry[] = [];

		if (options.open) {
			entries.push({
				id: 'open',
				label: t('components.contextMenu.open'),
				icon: 'document-open',
				accelerator: 'Enter',
			});
		}

		entries.push(
			{
				id: 'openWithSystem',
				label: t('components.contextMenu.openWithSystem'),
				icon: 'system-run',
			},
			{ type: 'separator' }
		);

		if (isImage) {
			entries.push({
				id: 'copyImage',
				label: t('components.contextMenu.copyImage'),
				icon: 'edit-copy',
			});
		}

		entries.push(
			{ id: 'copyPath', label: t('components.contextMenu.copyPath'), icon: 'edit-copy-path' },
			{
				id: 'showInFiles',
				label: t('components.contextMenu.showInFiles'),
				icon: 'system-file-manager',
			}
		);

		if (isImage) {
			entries.push(
				{ type: 'separator' },
				{
					id: 'setWallpaper',
					label: t('components.contextMenu.setWallpaper'),
					icon: 'preferences-desktop-wallpaper',
				}
			);
		}

		return entries;
	}

	function backgroundEntries(): MenuEntry[] {
		const filter = options.currentFilter?.();
		const order = options.currentSort?.();

		return [
			{ id: 'reload', label: t('components.contextMenu.reload'), icon: 'view-refresh' },
			{ id: 'scan', label: t('components.contextMenu.scan'), icon: 'system-search' },
			{ type: 'separator' },
			{
				type: 'submenu',
				label: t('components.contextMenu.filter'),
				icon: 'view-filter',
				items: [
					{
						type: 'checkbox',
						id: 'filter:all',
						label: t('components.contextMenu.filterAll'),
						checked: filter === 'all',
					},
					{
						type: 'checkbox',
						id: 'filter:image',
						label: t('components.contextMenu.filterImages'),
						checked: filter === 'image',
					},
					{
						type: 'checkbox',
						id: 'filter:video',
						label: t('components.contextMenu.filterVideos'),
						checked: filter === 'video',
					},
				],
			},
			{
				type: 'submenu',
				label: t('components.contextMenu.sort'),
				icon: 'view-sort-descending',
				items: [
					{
						type: 'checkbox',
						id: 'sort:newest',
						label: t('components.contextMenu.sortNewest'),
						checked: order === 'newest',
					},
					{
						type: 'checkbox',
						id: 'sort:oldest',
						label: t('components.contextMenu.sortOldest'),
						checked: order === 'oldest',
					},
				],
			},
		];
	}

	/** Abre el menú sobre `item`, o el del fondo si se hizo clic fuera de una foto. */
	async function showMenu(event: MouseEvent, item: MediaItem | null) {
		const showsViewOptions = Boolean(options.reload || options.scan);
		const entries = item ? mediaEntries(item) : showsViewOptions ? backgroundEntries() : [];

		const chosen = await show(entries, event);
		if (!chosen) {
			return;
		}

		// Elegir un filtro o un orden es elegir uno entre varios, no encender o
		// apagar una casilla: se aplica lo elegido sin mirar cómo estaba la
		// tilde.
		if (chosen.id.startsWith('filter:')) {
			options.filter?.(chosen.id.slice('filter:'.length) as FilterType);
			return;
		}

		if (chosen.id.startsWith('sort:')) {
			options.sort?.(chosen.id.slice('sort:'.length) as SortOrder);
			return;
		}

		switch (chosen.id) {
			case 'open':
				if (item) options.open?.(item);
				break;
			case 'openWithSystem':
				if (item) await actions.openWithSystem(item);
				break;
			case 'copyImage':
				if (item) await actions.copyImage(item);
				break;
			case 'copyPath':
				if (item) await actions.copyPath(item);
				break;
			case 'showInFiles':
				if (item) await actions.showInFileManager(item);
				break;
			case 'setWallpaper':
				if (item) await actions.setAsWallpaper(item);
				break;
			case 'reload':
				options.reload?.();
				break;
			case 'scan':
				options.scan?.();
				break;
		}
	}

	return { showMenu };
}
