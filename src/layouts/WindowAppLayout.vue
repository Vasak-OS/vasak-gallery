<script lang="ts" setup>
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useConfigStore } from '@vasakgroup/plugin-config-manager';
import type { Store } from 'pinia';
import { onMounted, onUnmounted, type Ref, ref } from 'vue';
import { RouterView } from 'vue-router';
import TopBarComponent from '@/components/topbar/TopBarComponent.vue';
import { useReactiveIcon } from '@/composables/useReactiveIcon';

let unListenConfig: Ref<UnlistenFn | null> = ref(null);
const appIcon = useReactiveIcon('photo');

onMounted(async () => {
	try {
		const configStore = useConfigStore() as Store<
			'config',
			{ config: any; loadConfig: () => Promise<void> }
		>;
		await configStore.loadConfig();

		unListenConfig.value = await listen('config-changed', async () => {
			document.startViewTransition(() => {
				configStore.loadConfig();
			});
		});
	} catch (error: any) {
		console.error('Error al cargar configuración en WindowAppLayout.vue', error);
	}
});

onUnmounted(() => {
	if (unListenConfig.value !== null) {
		unListenConfig.value();
	}
});
</script>
<template>
  <div
    class="h-screen w-screen bg-ui-bg/80 rounded-corner-window flex flex-col border border-ui-border overflow-hidden">
    <TopBarComponent>
      <img :src="appIcon" alt="Logo" class="h-6 w-6" />
      <span class="font-bold">Gallery</span>
      <span></span>
    </TopBarComponent>
    <div class="flex min-h-0 flex-1 p-1">
      <RouterView class="min-h-0 flex-1" />
    </div>
  </div>
</template>
