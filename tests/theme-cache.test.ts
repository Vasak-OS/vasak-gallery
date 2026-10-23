import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyTheme, saveTheme, THEME_KEY } from '../src/tools/theme-cache';

function fakeStorage(initial: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(initial));
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (k: string) => data.get(k) ?? null,
		key: (i: number) => Array.from(data.keys())[i] ?? null,
		removeItem: (k: string) => void data.delete(k),
		setItem: (k: string, v: string) => void data.set(k, v),
	};
}

function throwingStorage(): Storage {
	const fail = () => {
		throw new Error('localStorage no disponible');
	};
	return { ...fakeStorage(), getItem: fail, setItem: fail } as Storage;
}

describe('theme-cache', () => {
	test('la clave es la que comparte con index.html', () => {
		expect(THEME_KEY).toBe('vsk-theme');
	});

	test('saveTheme guarda la clase oscura y sólo las variables --*', () => {
		const root = document.createElement('div');
		root.classList.add('dark');
		root.style.setProperty('--ui-bg', '#111');
		root.style.setProperty('color', 'red');
		const store = fakeStorage();

		saveTheme(root, store);

		expect(JSON.parse(store.getItem(THEME_KEY) as string)).toEqual({
			dark: true,
			vars: { '--ui-bg': '#111' },
		});
	});

	test('applyTheme reaplica la clase oscura y las variables', () => {
		const root = document.createElement('div');
		const store = fakeStorage({
			[THEME_KEY]: JSON.stringify({ dark: true, vars: { '--ui-bg': '#222' } }),
		});

		applyTheme(root, store);

		expect(root.classList.contains('dark')).toBe(true);
		expect(root.style.getPropertyValue('--ui-bg')).toBe('#222');
	});

	test('ida y vuelta: lo guardado en un elemento se reaplica en otro', () => {
		const a = document.createElement('div');
		a.style.setProperty('--primary', '#abc');
		const b = document.createElement('div');
		const store = fakeStorage();

		saveTheme(a, store);
		applyTheme(b, store);

		expect(b.classList.contains('dark')).toBe(false);
		expect(b.style.getPropertyValue('--primary')).toBe('#abc');
	});

	test('sin clave no hace nada', () => {
		const root = document.createElement('div');
		applyTheme(root, fakeStorage());
		expect(root.classList.contains('dark')).toBe(false);
		expect(root.getAttribute('style')).toBeNull();
	});

	test('un JSON inválido no lanza', () => {
		const root = document.createElement('div');
		expect(() => applyTheme(root, fakeStorage({ [THEME_KEY]: '{no' }))).not.toThrow();
	});

	test('un Storage que lanza no rompe ni al guardar ni al aplicar', () => {
		const root = document.createElement('div');
		expect(() => saveTheme(root, throwingStorage())).not.toThrow();
		expect(() => applyTheme(root, throwingStorage())).not.toThrow();
	});
});

describe('cableado del tema recordado', () => {
	const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

	test('index.html reaplica el tema antes de montar', () => {
		const html = read('../index.html');
		expect(html).toContain('vsk-theme');
		expect(html).toContain('classList.add("dark")');
		expect(html).toContain('setProperty');
		// El script va antes del bundle.
		expect(html.indexOf('vsk-theme')).toBeLessThan(html.indexOf('type="module"'));
	});

	test('WindowAppLayout guarda el tema tras cada loadConfig', () => {
		const src = read('../src/layouts/WindowAppLayout.vue');
		expect(src).toContain("from '@/tools/theme-cache'");
		const llamadas = src.match(/loadConfig\(\)\.then\(\(\) => saveTheme\(\)\)/g) ?? [];
		// La lectura inicial y el listener de config-changed.
		expect(llamadas.length).toBe(2);
	});
});
