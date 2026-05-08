/**
 * Tipos para componentes de galería
 */

export type MediaType = 'image' | 'video';
export type FilterType = 'all' | 'image' | 'video';

// ─── Modelos de datos ─────────────────────────────────────────────────────────

/**
 * Elemento de media desde el backend
 */
export interface MediaItem {
	id: number;
	original_path: string;
	thumbnail_path: string;
	media_type: MediaType;
	created_at: string;
	file_size: number;
}

/**
 * Resultado paginado del backend
 */
export interface PaginatedResult {
	items: MediaItem[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

/**
 * Elemento de media con estado de carga (usado en el grid)
 */
export interface MediaItemWithLoading extends MediaItem {
	isLoaded?: boolean;
	isError?: boolean;
}

// ─── Estado del escaneo ───────────────────────────────────────────────────────

export interface ScanState {
	isScanning: boolean;
	totalFound: number;
	processed: number;
	errors: number;
	currentDirectory?: string;
}

export interface ScanCompletedEvent {
	total_found: number;
	processed: number;
	errors: number;
}

// ─── ImageGrid ────────────────────────────────────────────────────────────────

export interface ImageGridProps {
	columns?: number;
	itemsPerPage?: number;
	autoScan?: boolean;
}

export interface ImageGridEvents {
	'image-clicked': (payload: { item: MediaItem; items: MediaItem[] }) => void;
	'scan-started': () => void;
	'scan-completed': (payload: { total: number; errors: number }) => void;
}

export interface ImageGridMethods {
	loadImages(page: number, mediaType: string): Promise<void>;
	scanMedia(): Promise<void>;
	filterByType(mediaType: string): void;
	goToPage(page: number): void;
	loadMore(): void;
}

/** Estado interno del grid */
export interface GridState {
	images: MediaItemWithLoading[];
	isLoading: boolean;
	isScanning: boolean;
	currentPage: number;
	totalItems: number;
	error: string | null;
	mediaType: FilterType;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

export interface LightboxProps {
	isOpen: boolean;
	currentItem: MediaItem | null;
	/** Lista completa de items para navegar con ← → */
	items: MediaItem[];
}

export interface LightboxEvents {
	close: () => void;
	navigate: (item: MediaItem) => void;
}

/** Estado del lightbox en el componente padre */
export interface LightboxState {
	isOpen: boolean;
	currentItem: MediaItem | null;
	items: MediaItem[];
}
