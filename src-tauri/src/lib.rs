use std::path::PathBuf;

/// Where the translations live.
///
/// The i18n plugin only probes paths relative to the executable and the working
/// directory, and none of those exist once the binary is installed in /usr/bin —
/// which would leave a packaged build showing raw translation keys. Resolving it
/// here and passing it explicitly covers both the dev tree and the installed
/// location.
fn locales_dir() -> Option<String> {
    let candidates = [
        PathBuf::from("locales"),
        PathBuf::from("src-tauri/locales"),
        PathBuf::from("/usr/share/vasak-gallery/locales"),
    ];

    candidates
        .into_iter()
        .find(|path| path.is_dir())
        .map(|path| path.to_string_lossy().into_owned())
}

/// Picks the startup language from the session locale, falling back to Spanish,
/// which is what the UI shipped with before it was translatable.
fn default_locale() -> String {
    let raw = std::env::var("LC_ALL")
        .or_else(|_| std::env::var("LC_MESSAGES"))
        .or_else(|_| std::env::var("LANG"))
        .unwrap_or_default();

    match raw.split(['_', '.', '@']).next().unwrap_or("") {
        "en" => "en".to_string(),
        _ => "es".to_string(),
    }
}

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
        .plugin(tauri_plugin_i18n_vsk::init_with_path(
            Some(default_locale()),
            locales_dir(),
        ))
        .plugin(tauri_plugin_vicons::init())
        .invoke_handler(tauri::generate_handler![
            crate::indexer::commands::scan_media,
            crate::indexer::commands::get_all_media,
            crate::indexer::commands::clear_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub mod indexer;
