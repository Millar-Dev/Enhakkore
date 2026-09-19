#!/usr/bin/env node
/**
 * Creates a new migration after you change prisma/schema.prisma.
 *
 *   npm run migration:new -- add-trip-difficulty
 *
 * How it works, without needing any database running:
 * prisma/migrations/schema.snapshot.prisma is the schema as it stood at the
 * last migration. This compares it with the current schema, writes the SQL for
 * the difference into prisma/migrations/<timestamp>_<name>/migration.sql, and
 * moves the snapshot forward.
 *
 * READ THE GENERATED SQL BEFORE COMMITTING. Prisma cannot tell a rename from
 * "delete one column, add another", so a rename comes out as DROP + ADD, which
 * would destroy that column's data on the live site. This script flags every
 * statement like that. Edit the SQL (e.g. to ALTER TABLE ... RENAME COLUMN)
 * when the intent was to keep the data.
 *
 * Migrations are written for PostgreSQL — the live database. Local SQLite
 * development keeps using `db push` and is unaffected.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const API_DIR = path.resolve(__dirname, '..');
const SCHEMA = path.join(API_DIR, 'prisma/schema.prisma');
const MIGRATIONS = path.join(API_DIR, 'prisma/migrations');
const SNAPSHOT = path.join(MIGRATIONS, 'schema.snapshot.prisma');

const name = (process.argv[2] ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!name) {
  console.error('\n  Give the migration a name:  npm run migration:new -- add-trip-difficulty\n');
  process.exit(1);
}
if (!fs.existsSync(SNAPSHOT)) {
  console.error(`\n  Missing ${path.relative(API_DIR, SNAPSHOT)} — it records the schema at the last migration.\n`);
  process.exit(1);
}

function asPostgres(schema) {
  return schema.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/, '$1"postgresql"');
}

const current = asPostgres(fs.readFileSync(SCHEMA, 'utf8'));
const tmp = path.join(os.tmpdir(), `enhakkore-schema-${process.pid}.prisma`);
fs.writeFileSync(tmp, current);

const diff = spawnSync(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-schema-datamodel', `"${SNAPSHOT}"`, '--to-schema-datamodel', `"${tmp}"`, '--script'],
  {
    cwd: API_DIR,
    shell: true,
    encoding: 'utf8',
    // Nothing connects; the datasource just needs a resolvable URL.
    env: { ...process.env, DATABASE_URL: 'postgresql://offline:offline@localhost:5432/offline' },
  },
);
fs.rmSync(tmp, { force: true });

if (diff.status !== 0) {
  console.error(diff.stderr || diff.stdout);
  process.exit(diff.status ?? 1);
}

const sql = diff.stdout.trim();
if (!sql || /^-- This is an empty migration\.?$/.test(sql)) {
  console.log('\n  No schema changes since the last migration — nothing to create.\n');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const dir = path.join(MIGRATIONS, `${stamp}_${name}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'migration.sql'), `${sql}\n`);
fs.writeFileSync(SNAPSHOT, current);

console.log(`\n  Created ${path.relative(API_DIR, path.join(dir, 'migration.sql'))}\n`);

// Anything that can destroy data on the live site gets called out explicitly.
const risky = sql
  .split('\n')
  .filter((line) => /\bDROP\b|ALTER COLUMN .* TYPE|SET NOT NULL/i.test(line) && !/^\s*--/.test(line));

if (risky.length > 0) {
  console.log('  ⚠  THIS MIGRATION CAN DELETE OR REWRITE DATA ON THE LIVE SITE:\n');
  for (const line of risky) console.log(`     ${line.trim()}`);
  console.log(
    '\n  If you renamed something, change the DROP + ADD into a RENAME in the SQL file so the data is kept.\n' +
      '  If a column became required, make sure existing rows get a value first.\n',
  );
} else {
  console.log('  No destructive statements. Review the SQL, then commit it with your schema change.\n');
}
