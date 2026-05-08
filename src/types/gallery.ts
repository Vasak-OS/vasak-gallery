/**
 * Tipos para componentes de galería
 */

export type MediaType = 'image' | 'video';
export type FilterType = 'all' | 'image' | 'video';

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
 * Elemento de media con estado de carga
 */
export interface MediaItemWithLoading extends MediaItem {
	isLoaded?: boolean;
	isError?: boolean;
}

/**
 * Estado del escaneo
 */
export interface ScanState {
	isScanning: boolean;
	totalFound: number;
	processed: number;
	errors: number;
	currentDirectory?: string;
}

/**
 * Respuesta de escaneo completado
 */
export interface ScanCompletedEvent {
	total_found: number;
	processed: number;
	errors: number;
}

/**
 * Eventos del ImageGrid
 */
export interface ImageGridEvents {
	'image-clicked': (payload: { originalPath: string; mediaType: MediaType }) => void;
	'scan-started': () => void;
	'scan-completed': (payload: { total: number; errors: number }) => void;
}

/**
 * Props del ImageGrid
 */
export interface ImageGridProps {
	columns?: number;
	itemsPerPage?: number;
	autoScan?: boolean;
}

/**
 * Métodos públicos del ImageGrid
 */
export interface ImageGridMethods {
	loadImages(page: number, mediaType: string): Promise<void>;
	scanMedia(): Promise<void>;
	filterByType(mediaType: string): void;
	goToPage(page: number): void;
	loadMore(): void;
}

/**
 * Estado del visor fullscreen
 */
export interface FullscreenViewerState {
	isOpen: boolean;
	originalPath: string;
	mediaType: MediaType;
}

/**
 * Props del FullscreenViewer
 */
export interface FullscreenViewerProps {
	originalPath: string;
	mediaType: MediaType;
	isOpen: boolean;
}

/**
 * Eventos del FullscreenViewer
 */
export interface FullscreenViewerEvents {
	close: () => void;
}

/**
 * Estado interno del grid
 */
export interface GridState {
	images: MediaItemWithLoading[];
	isLoading: boolean;
	isScanning: boolean;
	currentPage: number;
	totalItems: number;
	error: string | null;
	mediaType: FilterType;
}
