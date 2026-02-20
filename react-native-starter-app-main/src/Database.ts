import { open } from 'react-native-quick-sqlite';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: number;
  content: string;
  filePath: string;
  category: string;
  detection_type: 'TEXT' | 'OBJECT' | 'EMPTY';
}

// ─── Singleton DB ───────────────────────────────────────────────────────────

let _db: ReturnType<typeof open> | null = null;

const getDb = (): ReturnType<typeof open> => {
  if (!_db) {
    _db = open({ name: 'pinpoint.db' });
  }
  return _db;
};

// ─── FTS5 availability flag ─────────────────────────────────────────────────
let _ftsAvailable = false;

// ─── Schema Setup ───────────────────────────────────────────────────────────

export const setupDatabase = () => {
  try {
    const db = getDb();

    // Main data table — always required
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
    } catch (_) { /* column already exists — ignore */ }

    // Try FTS5 (may not be compiled into this SQLite build)
    try {
      db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
          content,
          filePath UNINDEXED,
          tokenize = 'unicode61'
        );
      `);

      db.execute(`
        CREATE TRIGGER IF NOT EXISTS fts_insert AFTER INSERT ON document_index BEGIN
          INSERT INTO fts_index(rowid, content, filePath)
          VALUES (NEW.id, NEW.content, NEW.filePath);
        END;
      `);

      db.execute(`
        CREATE TRIGGER IF NOT EXISTS fts_delete AFTER DELETE ON document_index BEGIN
          DELETE FROM fts_index WHERE rowid = OLD.id;
        END;
      `);

      db.execute(`
        CREATE TRIGGER IF NOT EXISTS fts_update AFTER UPDATE OF content ON document_index BEGIN
          DELETE FROM fts_index WHERE rowid = OLD.id;
          INSERT INTO fts_index(rowid, content, filePath)
          VALUES (NEW.id, NEW.content, NEW.filePath);
        END;
      `);

      _ftsAvailable = true;
      console.log('[DB] Database Ready (FTS5 enabled)');
    } catch (ftsError) {
      _ftsAvailable = false;
      console.warn('[DB] FTS5 not available, using LIKE fallback:', ftsError);
      console.log('[DB] Database Ready (LIKE mode)');
    }
  } catch (error) {
    console.error('[DB] Setup Failed:', error);
  }
};

// ─── Queries ────────────────────────────────────────────────────────────────

export const isFileIndexed = (path: string): boolean => {
  try {
    const db = getDb();
    const result = db.execute('SELECT id FROM document_index WHERE filePath = ? LIMIT 1', [path]);
    const rows = result?.rows?._array || (result?.rows ? Array.from(result.rows) : []);
    return rows.length > 0;
  } catch (e) {
    console.warn('[DB] isFileIndexed check failed:', e);
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
    const db = getDb();
    if (_ftsAvailable) {
      // DELETE first so the FTS trigger fires, then INSERT
      db.execute('DELETE FROM document_index WHERE filePath = ?', [path]);
      db.execute(
        'INSERT INTO document_index (content, filePath, category, detection_type) VALUES (?, ?, ?, ?)',
        [text.trim(), path, category, detectionType]
      );
    } else {
      // No triggers — use INSERT OR REPLACE directly
      db.execute(
        'INSERT OR REPLACE INTO document_index (content, filePath, category, detection_type) VALUES (?, ?, ?, ?)',
        [text.trim(), path, category, detectionType]
      );
    }
  } catch (e) {
    console.error('[DB] Save Failed:', e);
  }
};

/**
 * Search documents — uses FTS5 if available, falls back to LIKE.
 */
export const searchDocuments = (query: string): DocumentRecord[] => {
  try {
    const db = getDb();
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Try FTS5 first if available
    if (_ftsAvailable) {
      try {
        const ftsResults = db.execute(
          `SELECT d.id, d.content, d.filePath, d.category, d.detection_type
           FROM fts_index f
           JOIN document_index d ON d.id = f.rowid
           WHERE fts_index MATCH ?
           ORDER BY rank
           LIMIT 50`,
          [`"${trimmed}" OR ${trimmed}*`]
        );
        const rows = ftsResults?.rows?._array || (ftsResults?.rows ? Array.from(ftsResults.rows) : []);
        if (rows.length > 0) return rows as DocumentRecord[];
      } catch (_) {
        // FTS5 match can fail on special characters — fall through to LIKE
      }
    }

    // Fallback: LIKE search (always works)
    const likeResults = db.execute(
      `SELECT * FROM document_index WHERE LOWER(content) LIKE LOWER(?) LIMIT 50`,
      [`%${trimmed}%`]
    );
    return (likeResults?.rows?._array || (likeResults?.rows ? Array.from(likeResults.rows) : [])) as DocumentRecord[];
  } catch (e) {
    console.error('[DB] Search Failed:', e);
    return [];
  }
};

/** Returns the total number of indexed documents */
export const getIndexedCount = (): number => {
  try {
    const db = getDb();
    const result = db.execute('SELECT COUNT(*) as cnt FROM document_index');
    const rows = result?.rows?._array || (result?.rows ? Array.from(result.rows) : []);
    return rows.length > 0 ? (rows[0] as { cnt: number }).cnt : 0;
  } catch (e) {
    console.warn('[DB] Count Failed:', e);
    return 0;
  }
};

/** Clears all indexed documents — useful for a forced full re-index */
export const clearIndex = () => {
  try {
    const db = getDb();
    db.execute('DELETE FROM document_index');
    if (_ftsAvailable) {
      try { db.execute('DELETE FROM fts_index'); } catch (_) { }
    }
    console.log('[DB] Index cleared');
  } catch (e) {
    console.error('[DB] Clear Failed:', e);
  }
};