<script setup lang="ts">
import { provide, type Ref, ref } from 'vue';

interface Props {
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	class: '',
});

const isOpen = ref(false);
const position = ref({ x: 0, y: 0 });

provide<Ref<boolean>>('contextMenuOpen', isOpen);
provide('contextMenuPosition', position);

function closeMenu() {
	isOpen.value = false;
}

provide('closeContextMenu', closeMenu);
</script>

<template>
  <div :class="['relative', props.class]">
    <slot />
  </div>
</template>
