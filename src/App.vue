<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { onMounted } from 'vue';

onMounted(() => {
	// Afina el WebKit de la ventana para bajar su consumo de memoria.
	invoke('tune_webview').catch(() => {});
});
</script>

<template>
    <RouterView />
</template>
