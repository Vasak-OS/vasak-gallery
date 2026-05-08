use crate::indexer::database::{Database, MediaItem};
use crate::indexer::thumbnail::{generate_image_thumbnail, generate_video_thumbnail, is_image, is_video};
use chrono::Local;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use walkdir::WalkDir;
use log::{info, warn};

#[derive(Debug, Clone)]
pub struct ScanProgress {
    pub total_found: usize,
    pub processed: usize,
    pub errors: usize,
}

/// Obtiene las rutas de los directorios a escanear, respetando la localización del SO
pub fn get_media_directories() -> Vec<PathBuf> {
    let mut dirs_list = Vec::new();

    // Intentar añadir ~/Pictures (respeta la localización)
    if let Some(pics_dir) = dirs::picture_dir() {
        if pics_dir.exists() {
            dirs_list.push(pics_dir);
        }
    }

    // Intentar añadir ~/Downloads (respeta la localización)
    if let Some(downloads_dir) = dirs::download_dir() {
        if downloads_dir.exists() {
            dirs_list.push(downloads_dir);
        }
    }

    // Para Videos, como no existe dirs::video_dir(), intentar crear una lista
    // Primero intentar ~/Videos en inglés
    if let Some(home) = dirs::home_dir() {
        let videos_en = home.join("Videos");
        if videos_en.exists() {
            dirs_list.push(videos_en);
        }

        // Intentar nombres comunes en otros idiomas
        let video_names = vec!["Videos", "Vídeos", "Vidéos", "Videos"];
        for name in video_names {
            let video_dir = home.join(name);
            if video_dir.exists() && !dirs_list.contains(&video_dir) {
                dirs_list.push(video_dir);
            }
        }
    }

    dirs_list
}

/// Escanea los directorios de media y actualiza la base de datos
pub async fn scan_media_directories(db: Arc<Database>) -> Result<ScanProgress, String> {
    let progress = Arc::new(Mutex::new(ScanProgress {
        total_found: 0,
        processed: 0,
        errors: 0,
    }));

    let media_dirs = get_media_directories();
    info!("Scanning media directories: {:?}", media_dirs);

    for dir in media_dirs {
        scan_directory(&dir, &db, &progress).await?;
    }

    let final_progress = progress.lock().unwrap().clone();
    Ok(final_progress)
}

/// Escanea un directorio recursivamente
pub async fn scan_directory(
    dir: &Path,
    db: &Database,
    progress: &Arc<Mutex<ScanProgress>>,
) -> Result<(), String> {
    info!("Scanning directory: {:?}", dir);

    for entry in WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();

        // Verificar si es imagen o video
        let media_type = if is_image(path) {
            "image"
        } else if is_video(path) {
            "video"
        } else {
            continue;
        };

        {
            let mut p = progress.lock().unwrap();
            p.total_found += 1;
        }

        // Verificar si ya existe en la BD
        if let Ok(Some(_)) = db.get_by_path(path.to_str().unwrap_or("")) {
            {
                let mut p = progress.lock().unwrap();
                p.processed += 1;
            }
            continue;
        }

        // Generar miniatura
        let thumbnail_result = match media_type {
            "image" => generate_image_thumbnail(path),
            "video" => generate_video_thumbnail(path),
            _ => continue,
        };

        match thumbnail_result {
            Ok(thumbnail_path) => {
                let file_size = std::fs::metadata(path)
                    .map(|m| m.len() as i64)
                    .unwrap_or(0);

                // Usar la fecha de modificación real del archivo
                let created_at = std::fs::metadata(path)
                    .and_then(|m| m.modified())
                    .map(|t| {
                        let dt: chrono::DateTime<Local> = t.into();
                        dt.format("%Y-%m-%d %H:%M:%S").to_string()
                    })
                    .unwrap_or_else(|_| Local::now().format("%Y-%m-%d %H:%M:%S").to_string());

                let item = MediaItem {
                    id: 0,
                    original_path: path.to_string_lossy().to_string(),
                    thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
                    media_type: media_type.to_string(),
                    created_at,
                    file_size,
                };

                if let Err(e) = db.insert_or_update_media(&item) {
                    warn!("Error inserting media item: {}", e);
                    {
                        let mut p = progress.lock().unwrap();
                        p.errors += 1;
                    }
                } else {
                    {
                        let mut p = progress.lock().unwrap();
                        p.processed += 1;
                    }
                }
            }
            Err(e) => {
                warn!("Error generating thumbnail for {:?}: {}", path, e);
                {
                    let mut p = progress.lock().unwrap();
                    p.errors += 1;
                }
            }
        }
    }

    Ok(())
}
