import { open } from 'react-native-quick-sqlite';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id?: number;
  title?: string; // Newly added for Document matching
  content: string;
  filePath: string;
  type: 'IMAGE' | 'DOCUMENT';
  detection_type: 'TEXT' | 'OBJECT';
  timestamp: number;
}

// ─── Singleton DB ───────────────────────────────────────────────────────────

let _db: ReturnType<typeof open> | null = null;

const getDb = (): ReturnType<typeof open> => {
  if (!_db) {
    _db = open({ name: 'pinpoint.db' });
  }
  return _db;
};

export const closeDatabase = () => {
  if (_db) {
    try {
      _db.close();
      _db = null;
      console.log('[DB] Database Connection Closed safely');
    } catch (e) {
      console.error('[DB] Failed to close database safely', e);
    }
  }
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
        title TEXT,
        content TEXT,
        filePath TEXT UNIQUE,
        type TEXT DEFAULT 'IMAGE',
        detection_type TEXT DEFAULT 'TEXT',
        timestamp INTEGER
      );
    `);

    // Add columns if upgrading from old schema (safe to run even if column exists)
    try { db.execute(`ALTER TABLE document_index ADD COLUMN title TEXT;`); } catch (_) { }
    try { db.execute(`ALTER TABLE document_index ADD COLUMN type TEXT DEFAULT 'IMAGE';`); } catch (_) { }
    try { db.execute(`ALTER TABLE document_index ADD COLUMN detection_type TEXT DEFAULT 'TEXT';`); } catch (_) { }
    try { db.execute(`ALTER TABLE document_index ADD COLUMN timestamp INTEGER;`); } catch (_) { }

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
  title: string | null = null,
  content: string,
  filePath: string,
  type: 'IMAGE' | 'DOCUMENT',
  detection_type: 'TEXT' | 'OBJECT'
) => {
  if (!content.trim() && !title?.trim()) {
    console.log('[DB] Skipped empty indexing for:', filePath);
    return;
  }

  try {
    const db = getDb();
    // Always DELETE first to ensure FTS triggers fire correctly for updates
    db.execute('DELETE FROM document_index WHERE filePath = ?', [filePath]);
    db.execute(
      'INSERT INTO document_index (title, content, filePath, type, detection_type, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content.trim(), filePath, type, detection_type, Date.now()]
    );
    console.log(`[DB] Indexed ✅ [${type}] ${filePath}`);
  } catch (e) {
    console.error('[DB] Save Failed:', e);
  }
};

/**
 * Helper to process query results into DocumentRecord array.
 */
const processResults = (result: any): DocumentRecord[] => {
  const rows = result?.rows?._array || (result?.rows ? Array.from(result.rows) : []);
  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    filePath: row.filePath,
    type: row.type,
    detection_type: row.detection_type,
    timestamp: row.timestamp,
  })) as DocumentRecord[];
};

/**
 * Search documents — uses FTS5 if available, falls back to LIKE.
 */
export const searchDocuments = (query: string): DocumentRecord[] => {
  const t0 = Date.now();
  try {
    const db = getDb();
    const trimmed = query.trim();
    if (!trimmed) return [];

    let results: DocumentRecord[] = [];
    const safeQuery = trimmed.replace(/[^\w\s-]/g, '').trim(); // Strip out SQLite special characters

    if (_ftsAvailable && safeQuery) {
      try {
        // Prioritize title matches using FTS5 weighting (e.g., standard MATCH behavior finds both, but we can return title)
        const ftsResults = db.execute(
          `SELECT d.id, d.title, d.content, d.filePath, d.type, d.detection_type, d.timestamp
           FROM fts_index f
           JOIN document_index d ON d.id = f.rowid
           WHERE f.fts_index MATCH ?
           ORDER BY rank
           LIMIT 50`,
          [`"${safeQuery}"*`]
        );
        results = processResults(ftsResults);
        if (results.length > 0) {
          console.log(`[DB] FTS5 Search for "${safeQuery}" took ${Date.now() - t0}ms. Found ${results.length} hits.`);
          return results;
        }
      } catch (err) {
        console.warn(`[DB] FTS5 matches failed for query "${trimmed}":`, err);
      }
    }

    // Fallback: LIKE search
    // Using COLLATE NOCASE is vastly faster than LOWER(content)
    const likeResults = db.execute(
      `SELECT d.id, d.title, d.content, d.filePath, d.type, d.detection_type, d.timestamp FROM document_index d WHERE content LIKE ? COLLATE NOCASE LIMIT 50`,
      [`%${trimmed}%`]
    );
    results = processResults(likeResults);

    console.log(`[DB] LIKE Search for "${trimmed}" took ${Date.now() - t0}ms. Found ${results.length} hits.`);
    return results;
  } catch (e) {
    console.error(`[DB] Search Failed after ${Date.now() - t0}ms:`, e);
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