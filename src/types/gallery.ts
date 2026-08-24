export type MediaType = 'image' | 'video';
export type FilterType = 'all' | 'image' | 'video';
/** Orden de la grilla: lo último que entró primero, o al revés. */
export type SortOrder = 'newest' | 'oldest';

export interface MediaItem {
	id: number;
	original_path: string;
	thumbnail_path: string;
	media_type: MediaType;
	created_at: string;
	file_size: number;
}

export interface MediaItemWithLoading extends MediaItem {
	isLoaded?: boolean;
	isError?: boolean;
}

export interface LightboxProps {
	isOpen: boolean;
	currentItem: MediaItem | null;
	items: MediaItem[];
}

export interface LightboxState {
	isOpen: boolean;
	currentItem: MediaItem | null;
	items: MediaItem[];
}

export interface TimelineEntry {
	key: string;
	year: number;
	month: number;
	count: number;
}
