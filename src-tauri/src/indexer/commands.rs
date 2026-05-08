use crate::indexer::database::Database;
use crate::indexer::scanner::{scan_media_directories, ScanProgress};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use std::thread;
use tauri::Emitter;
use base64::Engine;

#[derive(Debug, Serialize, Clone)]
pub struct ScanResponse {
    pub total_found: usize,
    pub processed: usize,
    pub errors: usize,
}

impl From<ScanProgress> for ScanResponse {
    fn from(progress: ScanProgress) -> Self {
        ScanResponse {
            total_found: progress.total_found,
            processed: progress.processed,
            errors: progress.errors,
        }
    }
}

/// Wrapper para hacer Database Send + Sync (al usar Mutex)
pub struct SyncDatabase(pub Mutex<Arc<Database>>);

// Implementar Send + Sync manualmente
unsafe impl Send for SyncDatabase {}
unsafe impl Sync for SyncDatabase {}

/// Base de datos lazily initialized
static DB: Lazy<SyncDatabase> = Lazy::new(|| {
    match Database::new() {
        Ok(db) => SyncDatabase(Mutex::new(Arc::new(db))),
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            panic!("Database initialization failed");
        }
    }
});

/// Obtiene la instancia de la base de datos
fn get_db() -> Arc<Database> {
    let guard = DB.0.lock().unwrap();
    Arc::clone(&*guard)
}

/// Comando: Escanea los directorios de media (Pictures, Downloads, Videos)
/// Se ejecuta en un thread de background para no bloquear la UI
#[tauri::command]
pub fn scan_media(window: tauri::Window) -> Result<(), String> {
    let window_clone = window.clone();
    
    thread::spawn(move || {
        let db_ref = get_db();
        
        // Ejecutar scan en un tokio runtime
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| format!("Failed to create runtime: {}", e))?;
        
        let progress = rt.block_on(async {
            scan_media_directories(db_ref).await
        })?;
        
        // Emitir evento de finalización
        let _ = window_clone.emit("scan_completed", ScanResponse::from(progress));
        Ok::<(), String>(())
    });
    
    Ok(())
}

/// Comando: Obtiene miniaturas de forma paginada
#[tauri::command]
pub fn get_thumbnails(page: i64, perPage: i64) -> Result<crate::indexer::database::PaginatedResult, String> {
    let db = get_db();
    db.get_paginated(page, perPage)
        .map_err(|e| format!("Database error: {}", e))
}

/// Comando: Obtiene miniaturas por tipo (image/video) de forma paginada
#[tauri::command]
pub fn get_thumbnails_by_type(
    mediaType: String,
    page: i64,
    perPage: i64,
) -> Result<crate::indexer::database::PaginatedResult, String> {
    let db = get_db();
    
    // Validar tipo
    if !matches!(mediaType.as_str(), "image" | "video") {
        return Err("Invalid media_type. Must be 'image' or 'video'".to_string());
    }
    
    db.get_by_type_paginated(&mediaType, page, perPage)
        .map_err(|e| format!("Database error: {}", e))
}

/// Comando: Obtiene el total de elementos en la base de datos
#[tauri::command]
pub fn get_media_count() -> Result<i64, String> {
    let db = get_db();
    db.count()
        .map_err(|e| format!("Database error: {}", e))
}

/// Comando: Limpia la base de datos y elimina todas las miniaturas
#[tauri::command]
pub fn clear_cache() -> Result<String, String> {
    let db = get_db();
    
    // Limpiar base de datos
    db.clear_all()
        .map_err(|e| format!("Database error: {}", e))?;
    
    // Limpiar carpeta de miniaturas
    match crate::indexer::thumbnail::get_thumbnails_dir() {
        Ok(thumbnails_dir) => {
            if thumbnails_dir.exists() {
                std::fs::remove_dir_all(&thumbnails_dir)
                    .map_err(|e| format!("Error removing thumbnails directory: {}", e))?;
            }
        }
        Err(_) => {
            // Si no se puede determinar el directorio, simplemente continuar
        }
    }
    
    Ok("Cache cleared successfully".to_string())
}

/// Comando: Obtiene una miniatura como data URL (base64)
#[tauri::command]
pub fn get_thumbnail_data(path: String) -> Result<String, String> {
    // Validar que la ruta está dentro del directorio de miniaturas permitido
    let thumbnails_dir = crate::indexer::thumbnail::get_thumbnails_dir()
        .map_err(|e| format!("Cannot get thumbnails directory: {}", e))?;
    
    let requested_path = std::path::PathBuf::from(&path);
    let canonical_requested = requested_path.canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    let canonical_cache = thumbnails_dir.canonicalize()
        .map_err(|e| format!("Invalid cache directory: {}", e))?;
    
    // Verificar que la ruta solicitada está dentro del directorio de cache
    if !canonical_requested.starts_with(&canonical_cache) {
        return Err("Access denied: path outside thumbnails directory".to_string());
    }
    
    // Leer el archivo
    let data = std::fs::read(&path)
        .map_err(|e| format!("Failed to read thumbnail: {}", e))?;
    
    // Retornar como data URL base64
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/jpeg;base64,{}", base64_data))
}

