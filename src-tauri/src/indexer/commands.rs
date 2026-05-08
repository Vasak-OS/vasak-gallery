use crate::indexer::database::Database;
use crate::indexer::scanner::{scan_media_directories, ScanProgress};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use std::thread;
use tauri::Emitter;

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
pub fn get_thumbnails(page: i64, per_page: i64) -> Result<crate::indexer::database::PaginatedResult, String> {
    let db = get_db();
    db.get_paginated(page, per_page)
        .map_err(|e| format!("Database error: {}", e))
}

/// Comando: Obtiene miniaturas por tipo (image/video) de forma paginada
#[tauri::command]
pub fn get_thumbnails_by_type(
    media_type: String,
    page: i64,
    per_page: i64,
) -> Result<crate::indexer::database::PaginatedResult, String> {
    let db = get_db();
    
    // Validar tipo
    if !matches!(media_type.as_str(), "image" | "video") {
        return Err("Invalid media_type. Must be 'image' or 'video'".to_string());
    }
    
    db.get_by_type_paginated(&media_type, page, per_page)
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
