use image::open as open_image;
use std::path::{Path, PathBuf};
use std::process::Command;

const THUMBNAIL_SIZE: u32 = 200;

pub fn get_thumbnails_dir() -> Result<PathBuf, String> {
    dirs::cache_dir()
        .ok_or_else(|| "Cannot determine cache directory".to_string())
        .map(|cache_dir| {
            cache_dir.join("vasak-gallery").join("thumbnails")
        })
}

/// Genera una miniatura para una imagen y retorna la ruta de la miniatura
pub fn generate_image_thumbnail(image_path: &Path) -> Result<PathBuf, String> {
    let thumbnails_dir = get_thumbnails_dir()?;
    std::fs::create_dir_all(&thumbnails_dir)
        .map_err(|e| format!("Error creating thumbnails dir: {}", e))?;

    // Generar nombre único basado en el hash del path
    let hash = format!("{:x}", fxhash::hash64(image_path.to_string_lossy().as_ref()));
    let thumbnail_path = thumbnails_dir.join(format!("{}.jpg", hash));

    // Si la miniatura ya existe, retornarla
    if thumbnail_path.exists() {
        return Ok(thumbnail_path);
    }

    // Leer la imagen
    let img = open_image(image_path)
        .map_err(|e| format!("Error reading image: {}", e))?
        .to_rgb8();

    // Redimensionar manteniendo aspect ratio
    let width = img.width();
    let height = img.height();
    let ratio = (width as f32 / height as f32).max(height as f32 / width as f32);
    
    let (new_width, new_height) = if width >= height {
        (THUMBNAIL_SIZE, (THUMBNAIL_SIZE as f32 / ratio) as u32)
    } else {
        ((THUMBNAIL_SIZE as f32 / ratio) as u32, THUMBNAIL_SIZE)
    };

    let thumbnail = image::imageops::resize(&img, new_width, new_height, image::imageops::FilterType::Lanczos3);

    // Guardar como JPEG
    thumbnail.save_with_format(&thumbnail_path, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Error saving thumbnail: {}", e))?;

    Ok(thumbnail_path)
}

/// Genera una miniatura para un video extrayendo el primer frame
pub fn generate_video_thumbnail(video_path: &Path) -> Result<PathBuf, String> {
    let thumbnails_dir = get_thumbnails_dir()?;
    std::fs::create_dir_all(&thumbnails_dir)
        .map_err(|e| format!("Error creating thumbnails dir: {}", e))?;

    // Generar nombre único basado en el hash del path
    let hash = format!("{:x}", fxhash::hash64(video_path.to_string_lossy().as_ref()));
    let thumbnail_path = thumbnails_dir.join(format!("{}.jpg", hash));

    // Si la miniatura ya existe, retornarla
    if thumbnail_path.exists() {
        return Ok(thumbnail_path);
    }

    // Usar ffmpeg para extraer el primer frame
    let output = Command::new("ffmpeg")
        .arg("-hide_banner")
        .arg("-loglevel").arg("error")
        .arg("-ss").arg("00:00:00.500")
        .arg("-i").arg(video_path.to_string_lossy().as_ref())
        .arg("-vf").arg(&format!("scale={}:{}:force_original_aspect_ratio=decrease", THUMBNAIL_SIZE, THUMBNAIL_SIZE))
        .arg("-vframes").arg("1")
        .arg("-q:v").arg("5")
        .arg(&thumbnail_path.to_string_lossy().to_string())
        .output()
        .map_err(|e| format!("Error executing ffmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    Ok(thumbnail_path)
}

/// Verifica si un archivo es una imagen soportada
pub fn is_image(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase()),
        Some(ext) if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "tiff")
    )
}

/// Verifica si un archivo es un video soportado
pub fn is_video(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase()),
        Some(ext) if matches!(ext.as_str(), "mp4" | "mkv" | "webm" | "avi" | "mov" | "flv" | "wmv" | "m4v" | "3gp" | "ogv")
    )
}

