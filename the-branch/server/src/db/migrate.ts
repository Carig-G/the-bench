import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await db.pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map((row: { name: string }) => row.name);
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executed.includes(file)) {
      console.log(`Skipping ${file} (already executed)`);
      continue;
    }

    const filePath = join(migrationsDir, file);
    let sql = readFileSync(filePath, 'utf-8');

    // Extract UP migration (before -- DOWN marker)
    const upSql = sql.split('-- DOWN')[0].trim();

    console.log(`Running migration: ${file}`);

    // Execute the migration
    await db.pool.query(upSql);

    // Record the migration
    await db.pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);

    console.log(`Completed: ${file}`);
  }
}

async function rollbackLastMigration(): Promise<void> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

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
  await db.pool.query(downSql);
  await db.pool.query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
  console.log(`Rolled back: ${lastMigration}`);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    if (command === 'down') {
      await rollbackLastMigration();
    } else {
      await runMigrations();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
