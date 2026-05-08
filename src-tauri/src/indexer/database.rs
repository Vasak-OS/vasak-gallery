use rusqlite::{Connection, params, OptionalExtension, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: i64,
    pub original_path: String,
    pub thumbnail_path: String,
    pub media_type: String, // "image" o "video"
    pub created_at: String,
    pub file_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResult {
    pub items: Vec<MediaItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

pub struct Database {
    conn: Arc<Connection>,
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Database {
            conn: Arc::clone(&self.conn),
        }
    }
}

impl Database {
    /// Inicializa la base de datos en `~/.cache/vasak-gallery/`
    pub fn new() -> SqliteResult<Self> {
        let cache_dir = dirs::cache_dir()
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?
            .join("vasak-gallery");
        
        std::fs::create_dir_all(&cache_dir)
            .map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;
        
        let db_path = cache_dir.join("gallery.db");
        let conn = Connection::open(db_path)?;
        
        // Habilitar WAL mode para mejor concurrencia
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")?;
        
        let db = Database { 
            conn: Arc::new(conn) 
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqliteResult<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS media_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_path TEXT NOT NULL UNIQUE,
                thumbnail_path TEXT NOT NULL,
                media_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
            CREATE INDEX IF NOT EXISTS idx_created_at ON media_items(created_at);
            CREATE INDEX IF NOT EXISTS idx_original_path ON media_items(original_path);"
        )?;
        Ok(())
    }

    /// Inserta o actualiza un elemento de media
    pub fn insert_or_update_media(&self, item: &MediaItem) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO media_items (original_path, thumbnail_path, media_type, created_at, file_size)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &item.original_path,
                &item.thumbnail_path,
                &item.media_type,
                &item.created_at,
                &item.file_size,
            ],
        )?;
        Ok(())
    }

    /// Obtiene un elemento por su ruta original
    pub fn get_by_path(&self, path: &str) -> SqliteResult<Option<MediaItem>> {
        self.conn.query_row(
            "SELECT id, original_path, thumbnail_path, media_type, created_at, file_size 
             FROM media_items WHERE original_path = ?1",
            params![path],
            |row| {
                Ok(MediaItem {
                    id: row.get(0)?,
                    original_path: row.get(1)?,
                    thumbnail_path: row.get(2)?,
                    media_type: row.get(3)?,
                    created_at: row.get(4)?,
                    file_size: row.get(5)?,
                })
            }
        ).optional()
    }

    /// Obtiene todos los elementos sin paginación, ordenados por fecha de archivo
    pub fn get_all(&self, media_type: Option<&str>) -> SqliteResult<Vec<MediaItem>> {
        let mut stmt = match media_type {
            Some(mt) => {
                let mut s = self.conn.prepare(
                    "SELECT id, original_path, thumbnail_path, media_type, created_at, file_size
                     FROM media_items WHERE media_type = ?1 ORDER BY created_at DESC"
                )?;
                let items = s.query_map([mt], |row| Ok(MediaItem {
                    id: row.get(0)?,
                    original_path: row.get(1)?,
                    thumbnail_path: row.get(2)?,
                    media_type: row.get(3)?,
                    created_at: row.get(4)?,
                    file_size: row.get(5)?,
                }))?.collect::<Result<Vec<_>, _>>()?;
                return Ok(items);
            }
            None => self.conn.prepare(
                "SELECT id, original_path, thumbnail_path, media_type, created_at, file_size
                 FROM media_items ORDER BY created_at DESC"
            )?,
        };
        let items = stmt.query_map([], |row| Ok(MediaItem {
            id: row.get(0)?,
            original_path: row.get(1)?,
            thumbnail_path: row.get(2)?,
            media_type: row.get(3)?,
            created_at: row.get(4)?,
            file_size: row.get(5)?,
        }))?.collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    /// Obtiene todos los elementos con paginación
    pub fn get_paginated(&self, page: i64, per_page: i64) -> SqliteResult<PaginatedResult> {
        let offset = (page - 1) * per_page;

        // Contar total
        let total: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM media_items",
            [],
            |row| row.get(0)
        )?;

        // Obtener elementos
        let mut stmt = self.conn.prepare(
            "SELECT id, original_path, thumbnail_path, media_type, created_at, file_size 
             FROM media_items ORDER BY indexed_at DESC LIMIT ?1 OFFSET ?2"
        )?;

        let items = stmt.query_map(params![per_page, offset], |row| {
            Ok(MediaItem {
                id: row.get(0)?,
                original_path: row.get(1)?,
                thumbnail_path: row.get(2)?,
                media_type: row.get(3)?,
                created_at: row.get(4)?,
                file_size: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        let total_pages = (total as f64 / per_page as f64).ceil() as i64;

        Ok(PaginatedResult {
            items,
            total,
            page,
            per_page,
            total_pages,
        })
    }

    /// Obtiene elementos paginados por tipo (image/video)
    pub fn get_by_type_paginated(
        &self,
        media_type: &str,
        page: i64,
        per_page: i64,
    ) -> SqliteResult<PaginatedResult> {
        let offset = (page - 1) * per_page;

        // Contar total
        let total: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM media_items WHERE media_type = ?1",
            params![media_type],
            |row| row.get(0)
        )?;

        // Obtener elementos
        let mut stmt = self.conn.prepare(
            "SELECT id, original_path, thumbnail_path, media_type, created_at, file_size 
             FROM media_items WHERE media_type = ?1 ORDER BY indexed_at DESC LIMIT ?2 OFFSET ?3"
        )?;

        let items = stmt.query_map(params![media_type, per_page, offset], |row| {
            Ok(MediaItem {
                id: row.get(0)?,
                original_path: row.get(1)?,
                thumbnail_path: row.get(2)?,
                media_type: row.get(3)?,
                created_at: row.get(4)?,
                file_size: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        let total_pages = (total as f64 / per_page as f64).ceil() as i64;

        Ok(PaginatedResult {
            items,
            total,
            page,
            per_page,
            total_pages,
        })
    }

    /// Elimina un elemento por su ruta original
    pub fn delete_by_path(&self, path: &str) -> SqliteResult<()> {
        self.conn.execute(
            "DELETE FROM media_items WHERE original_path = ?1",
            params![path],
        )?;
        Ok(())
    }

    /// Limpia todos los elementos de la BD
    pub fn clear_all(&self) -> SqliteResult<()> {
        self.conn.execute("DELETE FROM media_items", [])?;
        Ok(())
    }

    /// Obtiene la cantidad total de elementos
    pub fn count(&self) -> SqliteResult<i64> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM media_items",
            [],
            |row| row.get(0)
        )
    }
}
