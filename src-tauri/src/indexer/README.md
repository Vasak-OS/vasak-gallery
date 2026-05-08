# Módulo de Indexación de Media (Vasak Gallery)

Este módulo proporciona un sistema completo de indexación de imágenes y videos con generación de miniaturas.

## Características

- **Escaneo automático** de directorios: `~/Pictures`, `~/Downloads`, `~/Videos`
- **Soporte multiidioma**: Detecta automáticamente los nombres de carpetas según la localización del SO
- **Generación de miniaturas** (200x200px):
  - Para imágenes: Usa la crate `image`
  - Para videos: Usa `ffmpeg-sidecar` para extraer el primer frame
- **Base de datos SQLite** para almacenar rutas originales y de miniaturas
- **API paginada** para no saturar memoria
- **Caché eficiente** en `~/.cache/vasak-gallery/`

## Estructura

```
indexer/
├── mod.rs              # Módulo principal que exporta todo
├── database.rs         # Gestión de SQLite
├── scanner.rs          # Escaneo de directorios
├── thumbnail.rs        # Generación de miniaturas
├── commands.rs         # Comandos de Tauri que expone el frontend
└── README.md          # Este archivo
```

## Dependencias

Las siguientes crates se han añadido a `Cargo.toml`:

- `rusqlite` - SQLite sincrónico con WAL mode
- `image` - Procesamiento de imágenes
- `ffmpeg-sidecar` - Llamadas a ffmpeg para extraer frames de videos
- `walkdir` - Escaneo recursivo de directorios
- `dirs` - Detección de directorios home respetando localización
- `chrono` - Manejo de fechas
- `tokio` - Runtime asincrónico
- `fxhash` - Hashing rápido para nombres de miniaturas
- `log` / `env_logger` - Logging

## Comandos Disponibles

Todos los comandos están expuestos como `#[tauri::command]` y pueden ser llamados desde el frontend.

### 1. `scan_media()`
Escanea los directorios de media y genera miniaturas.

**Respuesta:**
```json
{
  "total_found": 1234,
  "processed": 1200,
  "errors": 34
}
```

**Uso en Frontend:**
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('scan_media');
console.log(`Procesados: ${result.processed}/${result.total_found}`);
```

### 2. `get_thumbnails(page: i64, per_page: i64)`
Obtiene todas las miniaturas con paginación.

**Parámetros:**
- `page`: Número de página (comienza en 1)
- `per_page`: Elementos por página (recomendado: 20-50)

**Respuesta:**
```json
{
  "items": [
    {
      "id": 1,
      "original_path": "/home/user/Pictures/photo.jpg",
      "thumbnail_path": "/home/user/.cache/vasak-gallery/thumbnails/a1b2c3d4.jpg",
      "media_type": "image",
      "created_at": "2024-01-15 10:30:45",
      "file_size": 2097152
    }
  ],
  "total": 1200,
  "page": 1,
  "per_page": 20,
  "total_pages": 60
}
```

**Uso en Frontend:**
```typescript
const page1 = await invoke('get_thumbnails', {
  page: 1,
  per_page: 20
});

console.log(`Página ${page1.page}/${page1.total_pages}`);
page1.items.forEach(item => {
  console.log(item.original_path, '->', item.thumbnail_path);
});
```

### 3. `get_thumbnails_by_type(media_type: string, page: i64, per_page: i64)`
Obtiene miniaturas filtradas por tipo.

**Parámetros:**
- `media_type`: `"image"` o `"video"`
- `page`: Número de página
- `per_page`: Elementos por página

**Respuesta:** Igual que `get_thumbnails()`

**Uso en Frontend:**
```typescript
// Obtener solo imágenes
const images = await invoke('get_thumbnails_by_type', {
  media_type: 'image',
  page: 1,
  per_page: 30
});

// Obtener solo videos
const videos = await invoke('get_thumbnails_by_type', {
  media_type: 'video',
  page: 1,
  per_page: 30
});
```

### 4. `get_media_count()`
Retorna el total de elementos indexados.

**Respuesta:** `1200` (número entero)

**Uso en Frontend:**
```typescript
const count = await invoke('get_media_count');
console.log(`Total de elementos: ${count}`);
```

### 5. `clear_cache()`
Limpia la base de datos y elimina todas las miniaturas.

**Respuesta:** `"Cache cleared successfully"`

**Uso en Frontend:**
```typescript
const result = await invoke('clear_cache');
console.log(result);
```

## Base de Datos

### Ubicación
`~/.cache/vasak-gallery/gallery.db`

### Esquema
```sql
CREATE TABLE media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT NOT NULL,
  media_type TEXT NOT NULL,       -- "image" o "video"
  created_at TEXT NOT NULL,       -- Fecha de creación del archivo original
  file_size INTEGER NOT NULL,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Índices
- `idx_media_type` - Para filtrar por tipo
- `idx_created_at` - Para ordenar por fecha
- `idx_original_path` - Para búsquedas rápidas

## Miniaturas

### Ubicación
`~/.cache/vasak-gallery/thumbnails/`

### Nombre
Las miniaturas se nombran con un hash FxHash de su ruta original:
```
a1b2c3d4e5f6g7h8.jpg  <- hash de /home/user/Pictures/photo.jpg
```

### Tamaño
- Todas las miniaturas se redimensionan a **200x200px**
- Imágenes: Guardadas como JPEG con calidad 85
- Videos: Primer frame extraído a los 500ms

## Directorios Soportados

El módulo detecta automáticamente los directorios según la localización del SO:

- **Pictures**: `~/Pictures` (o su equivalente localizado como `~/Imágenes`, `~/Photos`, etc.)
- **Downloads**: `~/Downloads` (o su equivalente localizado)
- **Videos**: `~/Videos`, `~/Vídeos`, `~/Vidéos`, etc.

Esto es posible gracias a la crate `dirs` que respeta las variables de entorno y la localización del sistema.

## Ejemplo Completo (Frontend)

```typescript
import { invoke } from '@tauri-apps/api/tauri';

async function loadGallery() {
  // 1. Escanear media
  console.log('Escaneando media...');
  const scanResult = await invoke('scan_media');
  console.log(`✓ Escaneadas ${scanResult.processed}/${scanResult.total_found} imágenes`);
  
  // 2. Obtener total
  const count = await invoke('get_media_count');
  console.log(`Total indexado: ${count}`);
  
  // 3. Cargar primeras imágenes
  const firstPage = await invoke('get_thumbnails', {
    page: 1,
    per_page: 20
  });
  
  console.log(`Página 1 de ${firstPage.total_pages}:`);
  firstPage.items.forEach(item => {
    console.log(`
      Original: ${item.original_path}
      Thumbnail: ${item.thumbnail_path}
      Tipo: ${item.media_type}
      Tamaño: ${item.file_size} bytes
    `);
  });
  
  // 4. Cargar siguiente página
  const secondPage = await invoke('get_thumbnails', {
    page: 2,
    per_page: 20
  });
  
  console.log(`Página 2 de ${secondPage.total_pages}:`);
  // ...procesarItems(secondPage.items);
}

loadGallery().catch(console.error);
```

## Notas de Implementación

### Rendimiento
- **WAL Mode**: La BD usa WAL (Write-Ahead Logging) para mejor concurrencia
- **Paginación**: Siempre usa paginación para no cargar toda la BD en memoria
- **Hash de miniaturas**: FxHash es muy rápido para nombres únicos
- **Caché**: Las miniaturas se reutilizan si ya existen

### Manejo de Errores
- Si ffmpeg no está instalado, se registrará un error al procesar videos
- Las imágenes corruptas se reportan pero no detienen el escaneo
- Los errores de BD están envueltos en `Result<T, String>`

### Logging
El módulo usa `log` crate. Para ver logs, setea:
```bash
RUST_LOG=info cargo tauri dev
```

## Mejoras Futuras

- [ ] Escaneo incremental (solo nuevos archivos)
- [ ] Búsqueda por EXIF (fecha de foto, cámara, etc.)
- [ ] Extracción de colores dominantes para preview
- [ ] Soporte para carpetas compartidas
- [ ] Sincronización de miniaturas a la nube
