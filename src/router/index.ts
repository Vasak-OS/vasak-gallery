import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{
			path: '/',
			component: () => import('@/layouts/WindowAppLayout.vue'),
			children: [
				{
					path: '',
					name: 'gallery',
					component: () => import('@/views/GalleryView.vue'),
				},
			],
		},
		{
			path: '/:pathMatch(.*)*',
			redirect: { name: 'gallery' },
		},
	],
});
