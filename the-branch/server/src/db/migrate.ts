import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, 'migrations');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function getExecutedMigrations(): string[] {
  const rows = db.prepare('SELECT name FROM migrations ORDER BY id').all() as { name: string }[];
  return rows.map((row) => row.name);
}

function runMigrations() {
  ensureMigrationsTable();
  const executed = getExecutedMigrations();

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executed.includes(file)) {
      console.log(`Skipping ${file} (already executed)`);
      continue;
    }

    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    // Extract UP migration (before -- DOWN marker)
    const upSql = sql.split('-- DOWN')[0].trim();

    console.log(`Running migration: ${file}`);
    db.exec(upSql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    console.log(`Completed: ${file}`);
  }
}

function rollbackLastMigration() {
  ensureMigrationsTable();
  const executed = getExecutedMigrations();

  if (executed.length === 0) {
    console.log('No migrations to rollback');
    return;
  }

  const lastMigration = executed[executed.length - 1];
  const filePath = join(migrationsDir, lastMigration);
  const sql = readFileSync(filePath, 'utf-8');

  // Extract DOWN migration (after -- DOWN marker)
  const parts = sql.split('-- DOWN');
  if (parts.length < 2) {
    console.log(`No DOWN migration found in ${lastMigration}`);
    return;
  }

  const downSql = parts[1].trim();

  console.log(`Rolling back: ${lastMigration}`);
  db.exec(downSql);
  db.prepare('DELETE FROM migrations WHERE name = ?').run(lastMigration);
  console.log(`Rolled back: ${lastMigration}`);
}

function main() {
  const command = process.argv[2];

  try {
    if (command === 'down') {
      rollbackLastMigration();
    } else {
      runMigrations();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
