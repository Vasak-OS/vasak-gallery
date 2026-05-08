/**
 * Ejemplo de uso del módulo de indexación de Vasak Gallery
 *
 * Este archivo muestra cómo usar los comandos de Tauri para acceder
 * a las miniaturas indexadas desde el frontend.
 */

import { invoke } from '@tauri-apps/api/core';

// Tipos TypeScript para las respuestas
interface MediaItem {
	id: number;
	original_path: string;
	thumbnail_path: string;
	media_type: 'image' | 'video';
	created_at: string;
	file_size: number;
}

interface PaginatedResult {
	items: MediaItem[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

interface ScanResponse {
	total_found: number;
	processed: number;
	errors: number;
}

/**
 * Escanea todos los directorios de media
 */
async function scanMedia(): Promise<ScanResponse> {
	try {
		const result = await invoke<ScanResponse>('scan_media');
		console.log(`✓ Escaneo completado: ${result.processed}/${result.total_found}`);
		if (result.errors > 0) {
			console.warn(`⚠ ${result.errors} errores durante el escaneo`);
		}
		return result;
	} catch (error) {
		console.error('Error al escanear media:', error);
		throw error;
	}
}

/**
 * Obtiene miniaturas con paginación
 */
async function getThumbnails(page: number = 1, perPage: number = 20): Promise<PaginatedResult> {
	try {
		const result = await invoke<PaginatedResult>('get_thumbnails', {
			page,
			perPage,
		});
		console.log(`Página ${result.page}/${result.total_pages} (${result.items.length} items)`);
		return result;
	} catch (error) {
		console.error('Error al obtener miniaturas:', error);
		throw error;
	}
}

/**
 * Obtiene miniaturas filtradas por tipo
 */
async function getThumbnailsByType(
	mediaType: 'image' | 'video',
	page: number = 1,
	perPage: number = 20
): Promise<PaginatedResult> {
	try {
		const result = await invoke<PaginatedResult>('get_thumbnails_by_type', {
			mediaType,
			page,
			perPage,
		});
		console.log(
			`${mediaType}s: ${result.total} total, página ${result.page}/${result.total_pages}`
		);
		return result;
	} catch (error) {
		console.error(`Error al obtener ${mediaType}s:`, error);
		throw error;
	}
}

/**
 * Obtiene el total de elementos indexados
 */
async function getMediaCount(): Promise<number> {
	try {
		const count = await invoke<number>('get_media_count');
		console.log(`Total de elementos indexados: ${count}`);
		return count;
	} catch (error) {
		console.error('Error al obtener cantidad de media:', error);
		throw error;
	}
}

/**
 * Limpia la caché de miniaturas
 */
async function clearCache(): Promise<void> {
	try {
		const result = await invoke<string>('clear_cache');
		console.log(result);
	} catch (error) {
		console.error('Error al limpiar caché:', error);
		throw error;
	}
}

/**
 * Ejemplo: Cargar la galería completa
 * @deprecated - Esta es una función de referencia, no está en uso
 * @see GalleryView.vue para implementación real
 */
export async function _loadGallery() {
	console.log('=== Cargando Galería ===');

	// 1. Escanear
	await scanMedia();

	// 2. Obtener total (información no utilizada en este ejemplo)
	await getMediaCount();

	// 3. Cargar primera página de todas las imágenes
	console.log('\n--- Todas las imágenes ---');
	const allMedia = await getThumbnails(1, 20);
	displayThumbnails(allMedia.items);

	// 4. Cargar solo imágenes
	console.log('\n--- Solo imágenes ---');
	const images = await getThumbnailsByType('image', 1, 20);
	displayThumbnails(images.items);

	// 5. Cargar solo videos
	console.log('\n--- Solo videos ---');
	const videos = await getThumbnailsByType('video', 1, 20);
	displayThumbnails(videos.items);
}

/**
 * Ejemplo: Navegar entre páginas
 * @deprecated - Esta es una función de referencia, no está en uso
 * @see GalleryView.vue para implementación real
 */
export async function _navigatePages(totalPages: number) {
	console.log('=== Navegando páginas ===');

	for (let page = 1; page <= Math.min(totalPages, 3); page++) {
		console.log(`\nCargando página ${page}:`);
		const result = await getThumbnails(page, 10);
		displayThumbnails(result.items);
	}
}

/**
 * Utilidad: Mostrar miniaturas en la consola
 */
function displayThumbnails(items: MediaItem[]) {
	items.forEach((item, index) => {
		console.log(`${index + 1}. [${item.media_type.toUpperCase()}]`);
		console.log(`   Original: ${item.original_path}`);
		console.log(`   Thumbnail: ${item.thumbnail_path}`);
		console.log(`   Fecha: ${item.created_at}`);
		console.log(`   Tamaño: ${formatBytes(item.file_size)}`);
	});
}

/**
 * Utilidad: Formatear bytes a formato legible
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round((bytes / k ** i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Ejemplo: Crear un componente React para mostrar galería
 */
interface GalleryState {
	items: MediaItem[];
	page: number;
	totalPages: number;
	mediaType: 'all' | 'image' | 'video';
	loading: boolean;
}

class GalleryComponent {
	private state: GalleryState = {
		items: [],
		page: 1,
		totalPages: 1,
		mediaType: 'all',
		loading: false,
	};

	async init() {
		// Escanear media
		await scanMedia();
		// Cargar primera página
		await this.loadPage(1, 'all');
	}

	async loadPage(page: number, mediaType: 'all' | 'image' | 'video') {
		this.state.loading = true;

		try {
			let result: PaginatedResult;

			if (mediaType === 'all') {
				result = await getThumbnails(page, 20);
			} else {
				result = await getThumbnailsByType(mediaType, page, 20);
			}

			this.state.items = result.items;
			this.state.page = result.page;
			this.state.totalPages = result.total_pages;
			this.state.mediaType = mediaType;

			this.render();
		} finally {
			this.state.loading = false;
		}
	}

	async nextPage() {
		if (this.state.page < this.state.totalPages) {
			await this.loadPage(this.state.page + 1, this.state.mediaType);
		}
	}

	async previousPage() {
		if (this.state.page > 1) {
			await this.loadPage(this.state.page - 1, this.state.mediaType);
		}
	}

	render() {
		console.log('=== Renderizando Galería ===');
		console.log(`Página ${this.state.page}/${this.state.totalPages}`);
		console.log(`Tipo: ${this.state.mediaType}`);
		console.log(`Items: ${this.state.items.length}`);

		this.state.items.forEach((item) => {
			console.log(`- ${item.original_path} (${item.media_type})`);
			// En un componente real, aquí crearías elementos del DOM
		});
	}
}

// Ejemplo de uso
export async function main() {
	console.log('Iniciando Vasak Gallery...\n');

	// Opción 1: Cargar galería completa
	// await loadGallery();

	// Opción 2: Navegar páginas
	// await navigatePages(5);

	// Opción 3: Usar componente
	const gallery = new GalleryComponent();
	await gallery.init();
	await gallery.nextPage();
	await gallery.nextPage();
}

// Exportar para uso en otros módulos
export {
	clearCache,
	GalleryComponent,
	getMediaCount,
	getThumbnails,
	getThumbnailsByType,
	scanMedia,
};
