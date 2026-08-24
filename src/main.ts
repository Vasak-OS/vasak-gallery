import { getIconSource } from '@vasakgroup/plugin-vicons';
import { setupContextMenu } from '@vasakgroup/plugin-vsk-contextual-menu';
import I18n from '@vasakgroup/tauri-plugin-i18n';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from '@/App.vue';
import { router } from '@/router';
import '@/assets/main.css';

const i18n = I18n.getInstance();

const app = createApp(App);
const pinia = createPinia();

i18n.load();

// El clic derecho abre el menú de VasakOS —el mismo de todo el escritorio— y no
// el del motor del navegador.
setupContextMenu({ iconResolver: getIconSource });

app.use(pinia);
app.use(router);

app.mount('#app');
