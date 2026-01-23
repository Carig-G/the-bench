import express from 'express';
import cors from 'cors';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import db from './db/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api', routes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Run migrations on startup
async function runMigrations(): Promise<void> {
  const migrationsDir = join(__dirname, 'db', 'migrations');

  // Create migrations table if it doesn't exist
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Get already executed migrations
  const result = await db.pool.query('SELECT name FROM migrations ORDER BY id');
  const executed = new Set(result.rows.map((row: { name: string }) => row.name));

  // Get and run pending migrations
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executed.has(file)) {
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

// Start server with migrations
async function start() {
  try {
    console.log('Running database migrations...');
    await runMigrations();
    console.log('Migrations complete.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
