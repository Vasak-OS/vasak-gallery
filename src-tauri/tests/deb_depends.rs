//! Que la lista de dependencias del `.deb` sea de Debian y de esta aplicación.
//!
//! La lista venía copiada de la plantilla `vapp` y no tenía relación con esta
//! aplicación: declaraba `libsoup2.4-1` y `libsoup-3.0-0` a la vez —las dos
//! generaciones, y el binario sólo enlaza la 3— y `libpango-1.0-0` sin
//! enlazarla. Y le faltaban `libdbus-1-3`, `libjavascriptcoregtk-4.1-0` y
//! `libsqlite3-0`, que el binario sí enlaza según `readelf -d`.
//!
//! `libgtk-layer-shell0` y `libasound2` **no** van, y es lo que dice el mismo
//! `readelf`: esta aplicación no usa la primera —no hay ninguna ventana en la
//! capa de superposición del compositor, a diferencia de la captura y la
//! bandeja— ni la segunda, porque no reproduce nada. Agregarlas «por si acaso»
//! ataría el `.deb` a dos paquetes que no hacen falta acá.
//!
//! `dbus` y los cuatro gstreamer se quedan: son el servicio y los códecs que se
//! usan sin enlazarlos. `sqlite3` se fue: es el programa de la línea de
//! comandos, y la galería enlaza la biblioteca (`libsqlite3-0`) sin llamar
//! nunca al programa. Entraron `ffmpeg`, que saca el cuadro de la miniatura de
//! cada vídeo (`indexer/thumbnail.rs`), y `xdg-utils`, que es por donde «Abrir
//! con reproductor del sistema» llega al programa de la persona: los dos se
//! ejecutan, así que ningún `readelf` los muestra.
//!
//! Lo que se declara se audita con `readelf -d … | grep NEEDED`, nunca con
//! `ldd`. Estas pruebas no reemplazan esa auditoría: cuidan que no vuelva a
//! entrar lo que ya se sacó y que no falte lo que se sabe que se enlaza.

use std::path::PathBuf;

fn deb_depends() -> Vec<String> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", path.display()));
    let config: serde_json::Value = serde_json::from_str(&text)
        .unwrap_or_else(|e| panic!("{} no es JSON válido: {e}", path.display()));
    config["bundle"]["linux"]["deb"]["depends"]
        .as_array()
        .expect("bundle.linux.deb.depends tiene que existir")
        .iter()
        .map(|v| {
            v.as_str()
                .expect("cada dependencia es un texto")
                .to_string()
        })
        .collect()
}

#[test]
fn deb_depends_use_debian_names() {
    for name in deb_depends() {
        // Los nombres de paquete de Debian: minúsculas, dígitos y `+-.`.
        let valid = name.len() >= 2
            && name
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_alphanumeric())
            && name
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || "+-.".contains(c));
        assert!(valid, "«{name}» no es un nombre de paquete de Debian");
        assert!(
            !name.ends_with("-devel"),
            "«{name}» es un nombre de Fedora, no de Debian"
        );
        assert!(
            !name.ends_with("-dev"),
            "«{name}» es de compilación: el paquete instalado no lo usa"
        );
    }
}

#[test]
fn deb_depends_have_no_duplicates() {
    let depends = deb_depends();
    let mut seen = std::collections::BTreeSet::new();
    for name in &depends {
        assert!(seen.insert(name), "«{name}» está dos veces");
    }
}

/// El binario enlaza libsoup 3 y nada más: la 2.4 viene de la plantilla.
#[test]
fn only_one_libsoup_generation() {
    let depends = deb_depends();
    assert!(
        !depends.iter().any(|n| n == "libsoup2.4-1"),
        "libsoup2.4-1 no la enlaza nadie: el binario usa libsoup-3.0"
    );
}

/// pango no aparece en ningún `NEEDED`: lo arrastra `libgtk-3-0t64`, que ya
/// está declarado. Declararlo también ataba el `.deb` a un paquete que no hace
/// falta para que la aplicación arranque.
#[test]
fn pango_is_not_declared() {
    let depends = deb_depends();
    assert!(
        !depends.iter().any(|n| n == "libpango-1.0-0"),
        "nada NEEDs pango directamente: lo trae libgtk-3-0t64"
    );
}

/// Ni la capa de superposición del compositor ni el audio: el `readelf` de este
/// binario no los nombra, y esta aplicación no tiene ninguna de las dos
/// funciones. Es la contra parte de la prueba de arriba en las otras
/// aplicaciones, y va acá para que una lista copiada de otra no se cuelgue sin
/// que nadie la revise.
#[test]
fn unused_packages_are_not_declared() {
    let depends = deb_depends();
    for (package, reason) in [
        (
            "libgtk-layer-shell0",
            "no hay ventana en la capa del compositor",
        ),
        ("libasound2", "esta aplicación no reproduce audio"),
    ] {
        assert!(
            !depends.iter().any(|n| n == package),
            "{package} no va en esta lista: {reason}"
        );
    }
}

/// Lo que `readelf -d` muestra enlazado, con su paquete de Debian. Los doce
/// sonames de fuera de la base del sistema, ni uno más. Si alguno deja de
/// enlazarse, se saca de la lista y de acá a la vez.
#[test]
fn linked_libraries_are_declared() {
    let depends = deb_depends();
    for (soname, package) in [
        ("libcairo.so.2", "libcairo2"),
        ("libdbus-1.so.3", "libdbus-1-3"),
        ("libgdk-3.so.0", "libgtk-3-0t64"),
        ("libgdk_pixbuf-2.0.so.0", "libgdk-pixbuf-2.0-0"),
        ("libgio-2.0.so.0", "libglib2.0-0t64"),
        ("libglib-2.0.so.0", "libglib2.0-0t64"),
        ("libgtk-3.so.0", "libgtk-3-0t64"),
        (
            "libjavascriptcoregtk-4.1.so.0",
            "libjavascriptcoregtk-4.1-0",
        ),
        ("libsoup-3.0.so.0", "libsoup-3.0-0"),
        ("libsqlite3.so.0", "libsqlite3-0"),
        ("libwebkit2gtk-4.1.so.0", "libwebkit2gtk-4.1-0"),
    ] {
        assert!(
            depends.iter().any(|n| n == package),
            "el binario enlaza {soname} y el .deb no declara {package}"
        );
    }
}

/// El índice de la galería y las miniaturas se leen de un SQLite.
#[test]
fn index_library_is_declared() {
    let depends = deb_depends();
    assert!(
        depends.iter().any(|n| n == "libsqlite3-0"),
        "el binario enlaza libsqlite3.so.0: sin libsqlite3-0 el .deb no arranca"
    );
}

/// Los dos programas que la galería ejecuta. No aparecen en ningún `NEEDED`
/// porque no se enlazan: se llaman.
#[test]
fn executed_programs_are_declared() {
    let depends = deb_depends();
    for (package, reason) in [
        ("ffmpeg", "saca el cuadro de la miniatura de cada vídeo"),
        (
            "xdg-utils",
            "«Abrir con reproductor del sistema» pasa por xdg-open",
        ),
    ] {
        assert!(
            depends.iter().any(|n| n == package),
            "falta {package}: {reason}"
        );
    }
}

/// La biblioteca de SQLite sí, su programa no: nadie lo llama.
#[test]
fn sqlite_cli_is_not_declared() {
    let depends = deb_depends();
    assert!(
        !depends.iter().any(|n| n == "sqlite3"),
        "sqlite3 es el programa de la línea de comandos: la galería sólo enlaza libsqlite3-0"
    );
}
