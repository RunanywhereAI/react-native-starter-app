import { open } from 'react-native-quick-sqlite';

let db: any;

export const setupDatabase = () => {
  try {
    db = open({ name: 'pinpoint.db' });
    // Add detection_type column to know whether result came from OCR or object labels
    db.execute(`
      CREATE TABLE IF NOT EXISTS document_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        filePath TEXT UNIQUE,
        category TEXT,
        detection_type TEXT DEFAULT 'TEXT'
      );
    `);
    // Add column if upgrading from old schema (safe to run even if column exists)
    try {
      db.execute(`ALTER TABLE document_index ADD COLUMN detection_type TEXT DEFAULT 'TEXT';`);
    } catch (_) { } // column already exists — ignore
    console.log("[DB] Database Ready");
  } catch (error) {
    console.error("[DB] Setup Failed:", error);
  }
};

export const isFileIndexed = (path: string): boolean => {
  try {
    if (!db) db = open({ name: 'pinpoint.db' });
    const result = db.execute('SELECT id FROM document_index WHERE filePath = ? LIMIT 1', [path]);
    const rows = result?.rows?._array || (result?.rows ? Array.from(result.rows) : []);
    return rows.length > 0;
  } catch (e) {
    return false;
  }
};

export const indexDocument = (
  text: string,
  path: string,
  category: string = 'General',
  detectionType: 'TEXT' | 'OBJECT' | 'EMPTY' = 'TEXT',
) => {
  try {
    if (!db) db = open({ name: 'pinpoint.db' });
    // INSERT OR REPLACE so re-syncing updates stale content
    db.execute(
      'INSERT OR REPLACE INTO document_index (content, filePath, category, detection_type) VALUES (?, ?, ?, ?)',
      [text.trim(), path, category, detectionType]
    );
  } catch (e) {
    console.error("[DB] Save Failed:", e);
  }
};

export const searchDocuments = (query: string) => {
  try {
    if (!db) db = open({ name: 'pinpoint.db' });
    const trimmed = query.trim();
    if (!trimmed) return [];

    // LOWER() for case-insensitive ASCII; Devanagari stored as-is
    const results = db.execute(
      `SELECT * FROM document_index WHERE LOWER(content) LIKE LOWER(?)`,
      [`%${trimmed}%`]
    );
    return results?.rows?._array || (results?.rows ? Array.from(results.rows) : []);
  } catch (e) {
    console.error("[DB] Search Failed:", e);
    return [];
  }
};

/** Clears all indexed documents — useful for a forced full re-index */
export const clearIndex = () => {
  try {
    if (!db) db = open({ name: 'pinpoint.db' });
    db.execute('DELETE FROM document_index');
    console.log('[DB] Index cleared');
  } catch (e) {
    console.error('[DB] Clear Failed:', e);
  }
};