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

/// El idioma de arranque a partir de la cadena de locale de la sesión.
///
/// Se toma la primera variable que traiga algo *de verdad*: una variable
/// definida pero vacía no dice nada del idioma de nadie. Con `LC_ALL=""` y
/// `LANG=en_US.UTF-8` —lo que deja más de un entorno de escritorio y más de un
/// lanzador— antes ganaba la vacía, y la galería abría en español a alguien que
/// tiene la sesión en inglés.
///
/// Si ninguna dice nada, se cae a español, que es con lo que salió la interfaz
/// antes de ser traducible.
fn language_from_locales(candidates: &[Option<&str>]) -> String {
    let raw = candidates
        .iter()
        .flatten()
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
        .unwrap_or("");

    match raw.split(['_', '.', '@']).next().unwrap_or("") {
        "en" => "en".to_string(),
        _ => "es".to_string(),
    }
}

/// Picks the startup language from the session locale, falling back to Spanish,
/// which is what the UI shipped with before it was translatable.
fn default_locale() -> String {
    let lc_all = std::env::var("LC_ALL").ok();
    let lc_messages = std::env::var("LC_MESSAGES").ok();
    let lang = std::env::var("LANG").ok();

    language_from_locales(&[lc_all.as_deref(), lc_messages.as_deref(), lang.as_deref()])
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
        .plugin(tauri_plugin_vsk_contextual_menu::init())
        .invoke_handler(tauri::generate_handler![
            crate::indexer::commands::scan_media,
            crate::indexer::commands::get_all_media,
            crate::indexer::commands::clear_cache,
            crate::clipboard::clipboard_copy_text,
            crate::clipboard::clipboard_copy_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub mod clipboard;
pub mod indexer;

#[cfg(test)]
mod tests {
    use super::language_from_locales;

    #[test]
    fn la_primera_variable_con_contenido_manda() {
        assert_eq!(
            language_from_locales(&[Some("en_US.UTF-8"), Some("es_AR.UTF-8"), None]),
            "en"
        );
    }

    /// El caso que motivó el arreglo: `LC_ALL=""` no significa «español», sólo
    /// que esa variable no dice nada. La sesión está en inglés y así tiene que
    /// abrir la galería.
    #[test]
    fn una_variable_vacia_no_decide_el_idioma() {
        assert_eq!(
            language_from_locales(&[Some(""), None, Some("en_US.UTF-8")]),
            "en"
        );
        assert_eq!(
            language_from_locales(&[Some("   "), Some(""), Some("en_GB")]),
            "en"
        );
    }

    #[test]
    fn sin_ninguna_variable_util_se_abre_en_espanol() {
        assert_eq!(language_from_locales(&[None, None, None]), "es");
        assert_eq!(language_from_locales(&[Some(""), Some(""), Some("")]), "es");
    }

    #[test]
    fn un_idioma_que_no_esta_traducido_cae_a_espanol() {
        assert_eq!(language_from_locales(&[Some("pt_BR.UTF-8")]), "es");
        assert_eq!(language_from_locales(&[Some("C")]), "es");
    }

    #[test]
    fn se_admiten_las_formas_en_que_se_escribe_un_locale() {
        for locale in ["en", "en_US", "en_US.UTF-8", "en@piglatin"] {
            assert_eq!(language_from_locales(&[Some(locale)]), "en", "{locale}");
        }
    }
}
