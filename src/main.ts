import I18n from '@vasakgroup/tauri-plugin-i18n';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from '@/App.vue';
import { router } from '@/router';
import { disableWebViewFeatures } from '@/utils/web-view-features';
import '@/assets/main.css';

const i18n = I18n.getInstance();

const app = createApp(App);
const pinia = createPinia();

i18n.load();

// El clic derecho ahora abre el menú de VasakOS y no el del motor del navegador.
disableWebViewFeatures();

app.use(pinia);
app.use(router);

app.mount('#app');
