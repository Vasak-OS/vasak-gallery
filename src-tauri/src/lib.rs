#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar logger
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .try_init()
        .ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_config_manager::init())
        .plugin(tauri_plugin_vicons::init())
        .invoke_handler(tauri::generate_handler![
            crate::indexer::commands::scan_media,
            crate::indexer::commands::get_thumbnails,
            crate::indexer::commands::get_thumbnails_by_type,
            crate::indexer::commands::get_media_count,
            crate::indexer::commands::clear_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod indexer;
