use crate::indexer::database::{Database, MediaItem};
use crate::indexer::thumbnail::{generate_image_thumbnail, generate_video_thumbnail, is_image, is_video};
use chrono::Local;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use walkdir::WalkDir;
use log::info;

#[derive(Debug, Clone)]
pub struct ScanProgress {
    pub total_found: usize,
    pub processed: usize,
    pub errors: usize,
}

pub fn get_media_directories() -> Vec<PathBuf> {
    let mut dirs_list = Vec::new();

    if let Some(pics_dir) = dirs::picture_dir() {
        if pics_dir.exists() {
            dirs_list.push(pics_dir);
        }
    }

    if let Some(downloads_dir) = dirs::download_dir() {
        if downloads_dir.exists() {
            dirs_list.push(downloads_dir);
        }
    }

    if let Some(home) = dirs::home_dir() {
        let videos_en = home.join("Videos");
        if videos_en.exists() {
            dirs_list.push(videos_en);
        }

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

pub async fn scan_media_directories(db: &Database) -> Result<ScanProgress, String> {
    let progress = Mutex::new(ScanProgress {
        total_found: 0,
        processed: 0,
        errors: 0,
    });

    let media_dirs = get_media_directories();
    info!("Scanning media directories: {:?}", media_dirs);

    for dir in media_dirs {
        scan_directory(&dir, db, &progress).await?;
    }

    let final_progress = progress.into_inner().unwrap();
    Ok(final_progress)
}

pub async fn scan_directory(
    dir: &Path,
    db: &Database,
    progress: &Mutex<ScanProgress>,
) -> Result<(), String> {
    info!("Scanning directory: {:?}", dir);

    for entry in WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();

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

        if let Ok(Some(_)) = db.get_by_path(path.to_str().unwrap_or("")) {
            {
                let mut p = progress.lock().unwrap();
                p.processed += 1;
            }
            continue;
        }

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
                    info!("Error inserting media item: {}", e);
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
                info!("Skipped {:?}: {}", path.file_name().unwrap_or_default(), e);
                {
                    let mut p = progress.lock().unwrap();
                    p.errors += 1;
                }
            }
        }
    }

    Ok(())
}
