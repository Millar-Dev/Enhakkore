#!/usr/bin/env node
/**
 * Runs the API test suite against a throwaway database.
 *
 *   npm test                          SQLite file prisma/test.db (default)
 *   TEST_DATABASE_URL=postgresql://…  PostgreSQL — what CI does
 *
 * Every run starts clean: the test database is wiped and rebuilt, then loaded
 * with the demonstration content, so tests can rely on known accounts and
 * trips. On PostgreSQL the database is rebuilt by applying the real migrations,
 * so every test run also proves the migrations still produce a working
 * database.
 *
 * NEVER point TEST_DATABASE_URL at a database you care about — it is erased.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const API_DIR = path.resolve(__dirname, '..');
const SCHEMA = path.join(API_DIR, 'prisma/schema.prisma');
const url = process.env.TEST_DATABASE_URL || 'file:./test.db';
const isPostgres = /^postgres(ql)?:\/\//.test(url);

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: url,
  JWT_SECRET: 'test-only-secret',
  CORS_ORIGIN: 'http://localhost:3000',
  SEED_DEMO_DATA: 'true',
  PAYMENT_PROVIDER: 'mock',
  RESEND_API_KEY: '',
};

function run(label, command, args, { input } = {}) {
  process.stdout.write(`  ${label}… `);
  const result = spawnSync(command, args, { cwd: API_DIR, env, shell: true, encoding: 'utf8', input });
  if (result.status !== 0) {
    console.log('FAILED\n');
    console.log(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  console.log('ok');
  return result;
}

/** Provider the currently generated Prisma client was built for. */
function generatedProvider() {
  try {
    const generated = require.resolve('.prisma/client/schema.prisma', { paths: [API_DIR] });
    return fs.readFileSync(generated, 'utf8').match(/datasource\s+db\s*\{[^}]*?provider\s*=\s*"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

const originalSchema = fs.readFileSync(SCHEMA, 'utf8');
let exitCode = 1;

try {
  console.log(`\nPreparing the test database (${isPostgres ? 'PostgreSQL' : 'SQLite'})`);
  run('matching the schema to the database', 'node', ['scripts/sync-datasource.js']);

  // Regenerating while a local dev server holds the engine file fails on
  // Windows, so only regenerate when the client is for the other database.
  const wanted = isPostgres ? 'postgresql' : 'sqlite';
  if (generatedProvider() !== wanted) run(`generating the ${wanted} client`, 'npx', ['prisma', 'generate']);

  if (isPostgres) {
    run('wiping the database', 'npx', ['prisma', 'db', 'execute', '--stdin'], {
      input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    });
    run('applying every migration from scratch', 'npx', ['prisma', 'migrate', 'deploy']);
  } else {
    // Start from no file at all rather than asking Prisma to wipe one: there is
    // nothing to destroy, and no destructive command to get wrong. Only a file
    // this runner owns is removed — never prisma/dev.db.
    const file = path.resolve(API_DIR, 'prisma', url.replace(/^file:/, ''));
    if (path.basename(file) !== 'test.db') {
      console.error(`\n  Refusing to touch ${file} — the SQLite test database must be called test.db.\n`);
      process.exit(1);
    }
    for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
    run('creating a fresh database', 'npx', ['prisma', 'db', 'push', '--skip-generate']);
  }
  run('loading the demonstration content', 'npx', ['tsx', 'prisma/seed.ts']);

  console.log('\nRunning tests\n');
  // One file at a time: every file shares the same database.
  const tests = spawnSync(
    'node',
    ['--import', 'tsx', '--test', '--test-concurrency=1', '--test-reporter=spec', '"tests/**/*.test.ts"'],
    { cwd: API_DIR, env, shell: true, stdio: 'inherit' },
  );
  exitCode = tests.status ?? 1;
} finally {
  // Leave the schema file exactly as it was (a Postgres run flips its provider).
  if (fs.readFileSync(SCHEMA, 'utf8') !== originalSchema) fs.writeFileSync(SCHEMA, originalSchema);
}

process.exit(exitCode);
