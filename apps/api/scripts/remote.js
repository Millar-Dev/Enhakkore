#!/usr/bin/env node
/**
 * Runs a database command against the REMOTE database instead of the local one.
 *
 * Two problems this solves:
 *
 * 1. `DATABASE_URL="…" npm run …` is Bash syntax and silently fails in
 *    PowerShell and cmd. So the connection string lives in
 *    apps/api/.env.production (gitignored) and is read from there.
 *
 * 2. The Prisma client is compiled for one provider. Seeding Postgres with a
 *    client generated for SQLite fails. So this switches the schema to
 *    postgresql, regenerates, does the work, then puts both back — leaving the
 *    local SQLite setup exactly as it found it, even if the command fails.
 *
 *   node scripts/remote.js push    create or update the tables
 *   node scripts/remote.js seed    load the demonstration content
 *   node scripts/remote.js studio  browse the remote data in a browser
 *   node scripts/remote.js reset   wipe and rebuild  (destructive)
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const API_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(API_DIR, '.env.production');
const SCHEMA = path.join(API_DIR, 'prisma/schema.prisma');

const COMMANDS = {
  push: { args: ['prisma', 'db', 'push', '--skip-generate'], label: 'Creating tables' },
  seed: { args: ['tsx', 'prisma/seed.ts'], label: 'Loading demonstration content' },
  studio: { args: ['prisma', 'studio'], label: 'Opening Prisma Studio' },
  reset: {
    args: ['prisma', 'db', 'push', '--force-reset', '--skip-generate'],
    label: 'Wiping and rebuilding',
    destructive: true,
  },
};

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function run(args, env) {
  return spawnSync('npx', args, { cwd: API_DIR, stdio: 'inherit', shell: true, env });
}

/* ---------------------------------------------------------------- arguments */

const command = process.argv[2];
if (!command || !COMMANDS[command]) {
  fail(`Usage: node scripts/remote.js <${Object.keys(COMMANDS).join('|')}>`);
}

if (!fs.existsSync(ENV_FILE)) {
  fail(
    'No apps/api/.env.production found.\n\n' +
      '  Create that file with one line — your Neon connection string:\n\n' +
      '    DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"\n\n' +
      '  It is gitignored, so it cannot be committed.',
  );
}

// Minimal .env parsing: KEY=VALUE, optional quotes, # comments, blank lines.
const env = {};
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const url = env.DATABASE_URL;
if (!url) fail('apps/api/.env.production has no DATABASE_URL line.');

if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
  fail(
    'DATABASE_URL in .env.production is not a Postgres connection string.\n\n' +
      `  Found:    ${url.slice(0, 44)}…\n` +
      '  Expected: postgresql://…',
  );
}

/* ------------------------------------------------------------------- run it */

const { args, label, destructive } = COMMANDS[command];
const redacted = url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••••@');

console.log(`\n  ${label}`);
console.log(`  Target: ${redacted}\n`);

if (destructive) {
  console.log('  This deletes every row in that database.');
  console.log('  Ctrl+C now if that is not what you want. Continuing in 5 seconds…\n');
  spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { stdio: 'ignore' });
}

const originalSchema = fs.readFileSync(SCHEMA, 'utf8');
const remoteEnv = { ...process.env, DATABASE_URL: url };
let status = 1;

try {
  // Point the schema at Postgres and build a matching client.
  fs.writeFileSync(
    SCHEMA,
    originalSchema.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/, '$1"postgresql"'),
  );

  console.log('  Preparing the Postgres client…\n');
  if (run(['prisma', 'generate'], remoteEnv).status !== 0) {
    throw new Error('prisma generate failed');
  }

  status = run(args, remoteEnv).status ?? 1;
} catch (error) {
  console.error(`\n  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  // Always restore the local SQLite setup, successful or not.
  fs.writeFileSync(SCHEMA, originalSchema);
  console.log('\n  Restoring the local SQLite client…');
  run(['prisma', 'generate'], { ...process.env, DATABASE_URL: 'file:./dev.db' });
}

if (status === 0) {
  console.log('\n  Done. Your local setup is unchanged.\n');
} else {
  console.error('\n  That did not complete. Nothing local was changed.\n');
}

process.exit(status);
