# Vasak Gallery

Una galería de medios de escritorio construida con **Tauri v2**, **Vue 3** y **TypeScript**, diseñada para integrarse con el ecosistema **VasakOS**.

![Vasak Gallery](src-tauri/icons/icon.png)

---

## Características

### Galería
- **Escaneo automático** de directorios del sistema (`~/Pictures`, `~/Videos`, `~/Downloads`) al iniciar
- **Grilla adaptativa** con miniaturas generadas localmente y almacenadas en caché (`~/.cache/vasak-gallery/thumbnails/`)
- **Agrupación por mes** — las imágenes se organizan automáticamente por fecha de creación
- **Filtros** por tipo de media: todo, solo imágenes, solo videos
- **Paginación** con carga incremental ("Cargar más")

### Línea de tiempo (Timeline)
- **Barra lateral colapsable** que muestra todos los años y meses con contenido
- Navegación instantánea: al hacer clic en un mes, el grid hace scroll suave hasta ese grupo
- Indicador visual del mes activo
- Se expande al pasar el cursor para mostrar etiquetas y conteos

### Lightbox
- **Visor de imágenes** con zoom (rueda del ratón, 0.5×–8×) y pan (click + arrastre)
- Doble clic para resetear el zoom
- Indicador de porcentaje de zoom
- **Reproductor de video** con controles personalizados al estilo VasakOS:
  - Barra de progreso con seek
  - Play/Pause, Mute, control de volumen
  - Auto-hide de controles durante reproducción
  - Fallback a reproductor del sistema (`xdg-open`) si el WebView no soporta el codec
- **Navegación entre archivos** con botones ← → o teclas de flecha
- Contador de posición (N / Total)
- Cierre con `Escape` o clic en el fondo

### Teclado
| Tecla | Acción |
|-------|--------|
| `Esc` | Cerrar lightbox |
| `←` `→` | Navegar entre imágenes |
| `Space` | Play/Pause (video) |
| `+` / `-` | Zoom in/out (imagen) |
| `0` | Resetear zoom |

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Shell | [Tauri v2](https://tauri.app) |
| Frontend | [Vue 3](https://vuejs.org) + [TypeScript](https://www.typescriptlang.org) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com) |
| Build | [Vite](https://vitejs.dev) + [Bun](https://bun.sh) |
| Backend | Rust (indexador, thumbnails, SQLite) |
| Base de datos | SQLite via `rusqlite` |
| Thumbnails | `image-rs` |

---

## Estructura del proyecto

```
vasak-gallery/
├── src/                        # Frontend Vue
│   ├── components/
│   │   ├── ImageGrid.vue       # Grilla principal con agrupación por mes
│   │   ├── Lightbox.vue        # Visor fullscreen con zoom y video player
│   │   ├── TimelineSidebar.vue # Barra lateral de navegación temporal
│   │   ├── FullscreenViewer.vue
│   │   └── topbar/
│   ├── layouts/
│   │   └── WindowAppLayout.vue
│   ├── types/
│   │   └── gallery.ts          # Todos los tipos TypeScript
│   └── views/
│       └── GalleryView.vue
│
└── src-tauri/                  # Backend Rust
    └── src/
        └── indexer/
            ├── scanner.rs      # Escaneo de directorios
            ├── thumbnail.rs    # Generación de miniaturas
            ├── database.rs     # SQLite (rusqlite)
            └── commands.rs     # Comandos Tauri expuestos al frontend
```

---

## Desarrollo

### Requisitos

- [Rust](https://rustup.rs) (stable)
- [Bun](https://bun.sh)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)
- En Linux: `webkit2gtk-4.1`, `libsoup-3.0`, `libcairo2`, `libgtk-3`

### Instalación

```bash
bun install
```

### Desarrollo

```bash
bun run tauri dev
```

### Build

```bash
bun run tauri build
```

---

## Caché

Los thumbnails se almacenan en:
```
~/.cache/vasak-gallery/thumbnails/
```

Para limpiar la caché desde la app, usar el comando `clear_cache` (disponible vía Tauri invoke).

---

## Reproducción de video en Linux

El WebView de Tauri usa **WebKit2GTK**, que en algunas distribuciones no incluye soporte H.264/MP4 por restricciones de licencias. Si un video no se puede reproducir en el visor integrado, aparece automáticamente un botón para abrirlo con el reproductor predeterminado del sistema (`xdg-open`).

Para habilitar reproducción nativa en Arch Linux, asegurarse de tener instalados:
```bash
sudo pacman -S gst-libav gst-plugins-ugly gst-plugins-bad
```

---

## Licencia

Ver [LICENSE](LICENSE).
