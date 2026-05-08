<script lang="ts" setup>
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useConfigStore } from '@vasakgroup/plugin-config-manager';
import { getIconSource } from '@vasakgroup/plugin-vicons';
import type { Store } from 'pinia';
import { onMounted, onUnmounted, type Ref, ref } from 'vue';
import { RouterView } from 'vue-router';
import TopBarComponent from '@/components/topbar/TopBarComponent.vue';

let unListenConfig: Ref<UnlistenFn | null> = ref(null);
const appIcon: Ref<string> = ref('');

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

onMounted(async() => {
   appIcon.value = await getIconSource('photo');
});

</script>
<template>
  <div
    class="h-screen w-screen bg-ui-bg/80 rounded-corner-window flex flex-col border border-ui-border overflow-hidden">
    <TopBarComponent>
      <img :src="appIcon" alt="Logo" class="h-6 w-6" />
      Gallery
    </TopBarComponent>
    <div class="flex-1 flex p-1">
      <RouterView v-slot="{ Component }">
        <component :is="Component" class="h-full w-full" />
      </RouterView>
    </div>
  </div>
</template>
