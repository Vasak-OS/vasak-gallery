import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getIconSource, getSymbolSource } from '@vasakgroup/plugin-vicons';
import { onMounted, onUnmounted, type Ref, ref } from 'vue';

type IconVariant = 'icon' | 'symbol';

interface TrackedIcon {
	name: string;
	variant: IconVariant;
	ref: Ref<string>;
}

const trackedIcons: TrackedIcon[] = [];
let unlisten: UnlistenFn | null = null;
let listenerPromise: Promise<void> | null = null;

async function ensureListener() {
	if (unlisten) return;
	if (listenerPromise) return listenerPromise;

	listenerPromise = listen('vicons:theme-changed', async () => {
		await Promise.all(
			trackedIcons.map(async (tracked) => {
				const source =
					tracked.variant === 'icon'
						? await getIconSource(tracked.name)
						: await getSymbolSource(tracked.name);
				tracked.ref.value = source;
			})
		);
	}).then((fn) => {
		unlisten = fn;
		if (trackedIcons.length === 0) {
			unlisten();
			unlisten = null;
			listenerPromise = null;
		}
	});

	return listenerPromise;
}

function cleanup() {
	if (trackedIcons.length === 0 && unlisten) {
		unlisten();
		unlisten = null;
		listenerPromise = null;
	}
}

export function useReactiveIcon(name: string): Ref<string>;
export function useReactiveIcon(name: string, variant: 'icon'): Ref<string>;
export function useReactiveIcon(name: string, variant: 'symbol'): Ref<string>;
export function useReactiveIcon(name: string, variant: IconVariant = 'icon'): Ref<string> {
	const iconRef = ref<string>('');
	const entry: TrackedIcon = { name, variant, ref: iconRef };

	trackedIcons.push(entry);

	onMounted(async () => {
		await ensureListener();
		iconRef.value = variant === 'icon' ? await getIconSource(name) : await getSymbolSource(name);
	});

	onUnmounted(() => {
		const idx = trackedIcons.indexOf(entry);
		if (idx !== -1) trackedIcons.splice(idx, 1);
		cleanup();
	});

	return iconRef;
}
