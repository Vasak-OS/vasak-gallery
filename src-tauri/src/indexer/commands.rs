use crate::indexer::database::Database;
use crate::indexer::scanner::{scan_media_directories, ScanProgress};
use serde::Serialize;
use once_cell::sync::Lazy;
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

static DB: Lazy<Database> = Lazy::new(|| {
    Database::new().expect("Failed to initialize database")
});

fn get_db() -> &'static Database {
    &DB
}

#[tauri::command]
pub fn scan_media(window: tauri::Window) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let db = get_db();
        match scan_media_directories(db, &window).await {
            Ok(progress) => {
                let _ = window.emit("scan_completed", ScanResponse::from(progress));
            }
            Err(e) => {
                eprintln!("Scan error: {}", e);
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub fn get_all_media(media_type: Option<String>) -> Result<Vec<crate::indexer::database::MediaItem>, String> {
    let db = get_db();
    db.get_all(media_type.as_deref())
        .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub fn clear_cache() -> Result<String, String> {
    let db = get_db();

    db.clear_all()
        .map_err(|e| format!("Database error: {}", e))?;

    match crate::indexer::thumbnail::get_thumbnails_dir() {
        Ok(thumbnails_dir) => {
            if thumbnails_dir.exists() {
                std::fs::remove_dir_all(&thumbnails_dir)
                    .map_err(|e| format!("Error removing thumbnails directory: {}", e))?;
            }
        }
        Err(_) => {}
    }

    Ok("Cache cleared successfully".to_string())
}
