import { open } from 'react-native-quick-sqlite';

let db: any;

export const setupDatabase = () => {
  try {
    db = open({ name: 'pinpoint.db' });
    db.execute(`
      CREATE TABLE IF NOT EXISTS document_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        filePath TEXT UNIQUE, 
        category TEXT
      );
    `);
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

export const indexDocument = (text: string, path: string, category: string = 'General') => {
  try {
    if (!db) db = open({ name: 'pinpoint.db' });
    db.execute(
      'INSERT OR IGNORE INTO document_index (content, filePath, category) VALUES (?, ?, ?)',
      [text, path, category]
    );
  } catch (e) {
    console.error("[DB] Save Failed:", e);
  }
};

export const searchDocuments = (query: string) => {
  try {
    if (!db) db = open({ name: 'pinpoint.db' });
    const results = db.execute(`SELECT * FROM document_index WHERE content LIKE ?`, [`%${query}%`]);
    return results?.rows?._array || (results?.rows ? Array.from(results.rows) : []);
  } catch (e) {
    return [];
  }
};