use crate::indexer::database::{Database, MediaItem};
use crate::indexer::thumbnail::{generate_image_thumbnail, generate_video_thumbnail, is_image, is_video};
use chrono::Local;
use log::info;
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{Emitter, Window};
use walkdir::WalkDir;

#[derive(Debug, Clone, serde::Serialize)]
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
        for name in ["Videos", "Vídeos", "Vidéos"] {
            let video_dir = home.join(name);
            if video_dir.exists() && !dirs_list.contains(&video_dir) {
                dirs_list.push(video_dir);
            }
        }
    }

    dirs_list
}

fn mtime_datetime(path: &Path) -> String {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| {
            let dt: chrono::DateTime<Local> = t.into();
            dt.format("%Y-%m-%d %H:%M:%S").to_string()
        })
        .unwrap_or_else(|_| Local::now().format("%Y-%m-%d %H:%M:%S").to_string())
}

/// Convert an EXIF datetime ("YYYY:MM:DD HH:MM:SS") into the DB's sortable
/// "YYYY-MM-DD HH:MM:SS" form.
fn normalize_exif_datetime(value: &str) -> Option<String> {
    let value = value.trim().trim_matches('"').trim();
    let (date, time) = value.split_once(' ')?;
    if date.len() != 10 {
        return None;
    }
    let date = date.replacen(':', "-", 2);
    let time = time.get(..8).unwrap_or(time);
    Some(format!("{date} {time}"))
}

/// Read the capture date from an image's EXIF metadata.
fn read_exif_datetime(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;
    for tag in [
        exif::Tag::DateTimeOriginal,
        exif::Tag::DateTimeDigitized,
        exif::Tag::DateTime,
    ] {
        if let Some(field) = exif.get_field(tag, exif::In::PRIMARY) {
            if let Some(dt) = normalize_exif_datetime(&field.display_value().to_string()) {
                return Some(dt);
            }
        }
    }
    None
}

/// Capture date used for the timeline: the EXIF original date for images (so
/// downloaded/copied photos keep their real date), falling back to the file
/// mtime; videos use the mtime.
fn capture_datetime(path: &Path, media_type: &str) -> String {
    if media_type == "image" {
        if let Some(dt) = read_exif_datetime(path) {
            return dt;
        }
    }
    mtime_datetime(path)
}

pub async fn scan_media_directories(db: &Database, window: &Window) -> Result<ScanProgress, String> {
    let media_dirs = get_media_directories();
    info!("Scanning media directories: {:?}", media_dirs);

    // Collect not-yet-indexed media files first (sequential, cheap).
    let mut candidates: Vec<(PathBuf, &'static str)> = Vec::new();
    for dir in &media_dirs {
        for entry in WalkDir::new(dir)
            .follow_links(false) // avoid symlink loops / double scans
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
            if matches!(db.get_by_path(path.to_str().unwrap_or("")), Ok(Some(_))) {
                continue;
            }
            candidates.push((path.to_path_buf(), media_type));
        }
    }

    let total = candidates.len();
    let processed = AtomicUsize::new(0);
    let errors = AtomicUsize::new(0);

    // Generate thumbnails in parallel (CPU/IO bound). DB writes serialise on the
    // connection mutex; progress is emitted throttled to the UI.
    candidates.par_iter().for_each(|(path, media_type)| {
        let thumbnail_result = match *media_type {
            "image" => generate_image_thumbnail(path),
            "video" => generate_video_thumbnail(path),
            _ => return,
        };

        match thumbnail_result {
            Ok(thumbnail_path) => {
                let file_size = std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0);
                let item = MediaItem {
                    id: 0,
                    original_path: path.to_string_lossy().to_string(),
                    thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
                    media_type: media_type.to_string(),
                    created_at: capture_datetime(path, media_type),
                    file_size,
                };
                if let Err(e) = db.insert_or_update_media(&item) {
                    info!("Error inserting media item: {}", e);
                    errors.fetch_add(1, Ordering::Relaxed);
                }
            }
            Err(e) => {
                info!("Skipped {:?}: {}", path.file_name().unwrap_or_default(), e);
                errors.fetch_add(1, Ordering::Relaxed);
            }
        }

        let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
        if done % 10 == 0 || done == total {
            let _ = window.emit(
                "scan_progress",
                ScanProgress {
                    total_found: total,
                    processed: done,
                    errors: errors.load(Ordering::Relaxed),
                },
            );
        }
    });

    Ok(ScanProgress {
        total_found: total,
        processed: processed.load(Ordering::Relaxed),
        errors: errors.load(Ordering::Relaxed),
    })
}
