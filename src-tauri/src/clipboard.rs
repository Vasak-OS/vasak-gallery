//! Portapapeles del sistema.
//!
//! El webview no alcanza para esto: WebKitGTK no deja poner una imagen en el
//! portapapeles desde `navigator.clipboard`, y mandarla en crudo al backend
//! significaría cruzar la foto entera descomprimida por el puente —una de 24
//! megapíxeles son casi cien megabytes—. GTK, que ya está abajo de la ventana,
//! la lee del disco y la pone directamente. Sus funciones de portapapeles sólo
//! se pueden llamar desde el hilo principal: de ahí el salto y el canal para
//! traer la respuesta.

use gtk::prelude::*;
use tauri::AppHandle;
use tokio::sync::oneshot;

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

/// Copia una foto al portapapeles sin que la ventana se quede dura mientras
/// tanto.
///
/// Leer y descomprimir una foto grande lleva su tiempo, y el portapapeles de
/// GTK sólo se toca desde el hilo principal —que es el mismo que atiende el
/// teclado, el ratón y el repintado—. Haciéndolo de corrido ahí, la galería se
/// congelaba desde que se elegía «copiar» hasta que la foto terminaba de
/// descomprimirse: nada respondía y la ventana quedaba en blanco al moverla.
///
/// Por eso la lectura y la descompresión van por las versiones asíncronas de
/// GIO: el trabajo pesado ocurre fuera del hilo principal y sólo el resultado
/// —el `Pixbuf`, que no se puede mover de hilo— vuelve a él, ya listo, para
/// pasar por el portapapeles. Entre medio la ventana sigue viva.
///
/// La respuesta al frontend se manda recién cuando terminaron `set_image` y
/// `store`, para que quien copió sepa que la foto ya está de verdad en el
/// portapapeles y no sólo que la lectura arrancó.
#[tauri::command]
pub async fn clipboard_copy_image(app: AppHandle, path: String) -> Result<(), String> {
    let (sender, receiver) = oneshot::channel::<Result<(), String>>();

    app.run_on_main_thread(move || {
        let file = gtk::gio::File::for_path(&path);

        file.read_async(
            gtk::glib::Priority::DEFAULT,
            gtk::gio::Cancellable::NONE,
            move |opened| {
                let stream = match opened {
                    Ok(stream) => stream,
                    Err(error) => {
                        let _ = sender.send(Err(format!("No se pudo abrir {path}: {error}")));
                        return;
                    }
                };

                gtk::gdk_pixbuf::Pixbuf::from_stream_async(
                    &stream,
                    gtk::gio::Cancellable::NONE,
                    move |decoded| {
                        let outcome = match decoded {
                            Ok(pixbuf) => {
                                let clipboard = gtk::Clipboard::get(&gtk::gdk::SELECTION_CLIPBOARD);
                                clipboard.set_image(&pixbuf);
                                // Igual que con el texto: sin `store` la foto se
                                // pierde al cerrar la galería.
                                clipboard.store();
                                Ok(())
                            }
                            Err(error) => Err(format!("No se pudo leer la imagen: {error}")),
                        };

                        let _ = sender.send(outcome);
                    },
                );
            },
        );
    })
    .map_err(|error| error.to_string())?;

    receiver
        .await
        .map_err(|_| "El portapapeles no contestó".to_string())?
}
