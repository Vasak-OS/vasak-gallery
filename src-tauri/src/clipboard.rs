//! Portapapeles del sistema.
//!
//! El webview no alcanza para esto: WebKitGTK no deja poner una imagen en el
//! portapapeles desde `navigator.clipboard`, y mandarla en crudo al backend
//! significaría cruzar la foto entera descomprimida por el puente —una de 24
//! megapíxeles son casi cien megabytes—. GTK, que ya está abajo de la ventana,
//! la lee del disco y la pone directamente. Sus funciones de portapapeles sólo
//! se pueden llamar desde el hilo principal: de ahí el salto y el canal para
//! traer la respuesta.

use tauri::AppHandle;

fn with_clipboard<T, F>(app: &AppHandle, action: F) -> Result<T, String>
where
    F: FnOnce(&gtk::Clipboard) -> T + Send + 'static,
    T: Send + 'static,
{
    let (sender, receiver) = std::sync::mpsc::channel();

    app.run_on_main_thread(move || {
        let clipboard = gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD);
        let _ = sender.send(action(&clipboard));
    })
    .map_err(|error| error.to_string())?;

    receiver.recv().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn clipboard_copy_text(app: AppHandle, text: String) -> Result<(), String> {
    with_clipboard(&app, move |clipboard| {
        clipboard.set_text(&text);
        // Pedirle al gestor de portapapeles que se quede con lo copiado: sin
        // esto se pierde en cuanto se cierra la galería.
        clipboard.store();
    })
}

#[tauri::command]
pub async fn clipboard_copy_image(app: AppHandle, path: String) -> Result<(), String> {
    with_clipboard(&app, move |clipboard| {
        let pixbuf = gtk::gdk_pixbuf::Pixbuf::from_file(&path).map_err(|error| error.to_string())?;
        clipboard.set_image(&pixbuf);
        clipboard.store();
        Ok(())
    })?
}
