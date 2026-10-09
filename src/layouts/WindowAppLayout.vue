<script lang="ts" setup>
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useConfigStore } from '@vasakgroup/plugin-config-manager';
import { useI18n } from '@vasakgroup/tauri-plugin-i18n';
import { ThemeIcon, ToastArea, WindowFrame } from '@vasakgroup/vue-libvasak';
import { nextTick, onMounted, onUnmounted, type Ref, ref } from 'vue';
import { RouterView } from 'vue-router';
import { useNotification } from '@/composables/useNotification';

const { t } = useI18n();

let unListenConfig: Ref<UnlistenFn | null> = ref(null);
const { notifications } = useNotification();

onMounted(async () => {
	// Que el layout se pinte primero, antes de cualquier lectura.
	await nextTick();

	const configStore = useConfigStore();

	try {
		await configStore.loadConfig();
	} catch (error: any) {
		console.error('Error al cargar configuración en WindowAppLayout.vue', error);
	}

	// Fuera del `try` de la lectura: aunque esa falle o nunca resuelva, los
	// cambios de configuración de después tienen que poder aplicarse. Antes,
	// un fallo en la primera lectura dejaba la suscripción sin registrar y la
	// galería se quedaba con los valores por defecto hasta reiniciar.
	try {
		unListenConfig.value = await listen('config-changed', async () => {
			document.startViewTransition(() => {
				configStore.loadConfig();
			});
		});
	} catch (error: any) {
		console.error('No se pudo escuchar los cambios de configuración', error);
	}
});

onUnmounted(() => {
	if (unListenConfig.value !== null) {
		unListenConfig.value();
	}
});
</script>
<template>
  <WindowFrame
    :minimize-label="t('windowControls.minimize')"
    :maximize-label="t('windowControls.maximize')"
    :close-label="t('windowControls.close')">
    <template #identidad>
      <ThemeIcon name="photo" :size="24" :alt="t('views.app.iconAlt')" />
    </template>

    <!-- El nombre al medio de la ventana entera. Estaba centrado con un tercer
         `span` vacío tirando contra el `justify-between` de la barra propia, y
         eso lo deja centrado respecto de lo que sobra entre el icono y los
         controles: los tres botones ocupan bastante más que el icono, así que
         se corría. -->
    <template #centro>
      <span class="font-title font-bold text-tx-main">{{ t('views.app.title') }}</span>
    </template>

    <div class="flex min-h-0 min-w-0 flex-1 p-1">
      <RouterView class="min-h-0 flex-1" />
    </div>
    <!-- Abajo al centro y no en la esquina: en una ventana de ver fotos, la
         esquina compite con los controles del visor. -->
    <ToastArea :toasts="notifications" position="bottom-center" />
  </WindowFrame>
</template>
