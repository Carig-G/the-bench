import Database, { Database as DatabaseType } from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store database in project root
const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'the_branch.db');

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

const db: DatabaseType = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;
