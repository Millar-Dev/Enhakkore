#!/usr/bin/env node
/**
 * Brings the database up to date with the code. Runs on every deploy.
 *
 * - SQLite (local development): `prisma db push`, as before. Fast, no history
 *   needed, and nothing on a laptop is precious.
 * - PostgreSQL (the live site): `prisma migrate deploy`, which applies only the
 *   reviewed SQL files in prisma/migrations that this database has not seen
 *   yet, each exactly once, recorded in a `_prisma_migrations` table.
 *
 * Baselining. The live database existed before migrations did — it was built
 * with `db push`. Such a database already has every table 0_init would create,
 * so 0_init must be *recorded* as applied rather than run. This script does
 * that once, and only after proving the database's structure matches 0_init
 * exactly. It also recovers if an earlier attempt stopped partway (history
 * table created but 0_init not recorded, or recorded as failed) — the state
 * that otherwise blocks every later deploy until someone repairs it by hand.
 *
 * Any step that fails stops the deploy before anything further changes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const API_DIR = path.resolve(__dirname, '..');
const MIGRATIONS = path.join(API_DIR, 'prisma/migrations');
const SNAPSHOT = path.join(MIGRATIONS, 'schema.snapshot.prisma');
const BASELINE = '0_init';
const url = process.env.DATABASE_URL ?? '';

function prisma(args, { allowExit = [] } = {}) {
  const result = spawnSync('npx', ['prisma', ...args], { cwd: API_DIR, stdio: 'inherit', shell: true, env: process.env });
  if (result.status !== 0 && !allowExit.includes(result.status)) {
    console.error(`\n[migrate] "prisma ${args.join(' ')}" failed — deploy stopped, nothing further was changed.`);
    process.exit(result.status ?? 1);
  }
  return result.status;
}

function stop(message) {
  console.error(`\n[migrate] ${message}\n[migrate] Deploy stopped. The database was not changed.`);
  process.exit(1);
}

async function inspect() {
  // The client was generated for PostgreSQL by the build step that ran first.
  const { PrismaClient } = require('@prisma/client');
  const client = new PrismaClient();
  try {
    const rows = await client.$queryRawUnsafe(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()',
    );
    const tables = new Set(rows.map((row) => row.table_name));
    const history = tables.has('_prisma_migrations')
      ? await client.$queryRawUnsafe(
          'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations',
        )
      : [];
    return { tables, history };
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  if (url.startsWith('file:')) {
    console.log('[migrate] SQLite (local development) — applying the schema with db push.');
    prisma(['db', 'push', '--skip-generate']);
    return;
  }
  if (!/^postgres(ql)?:\/\//.test(url)) stop('DATABASE_URL is neither SQLite nor PostgreSQL — refusing to guess.');

  const { tables, history } = await inspect();
  const baselineRows = history.filter((row) => row.migration_name === BASELINE);
  const baselineApplied = baselineRows.some((row) => row.finished_at && !row.rolled_back_at);
  const baselineFailed = baselineRows.some((row) => !row.finished_at && !row.rolled_back_at);

  if (tables.has('User') && !baselineApplied) {
    console.log(
      history.length === 0 && !tables.has('_prisma_migrations')
        ? '[migrate] This database was created before migrations existed.'
        : '[migrate] An earlier baseline attempt did not finish — recovering.',
    );

    // Only a database identical to 0_init may be marked as having run it. The
    // snapshot equals 0_init only while 0_init is the sole migration — which is
    // exactly when a pre-migrations database gets baselined.
    const migrationDirs = fs
      .readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    if (migrationDirs.length !== 1) {
      stop(
        `This database has never been baselined, but ${migrationDirs.length} migrations exist. ` +
          'Deploy the commit that introduced migrations first, or baseline manually (see docs/DEPLOYMENT.md).',
      );
    }

    console.log('[migrate] Checking the database structure matches 0_init exactly…');
    const same = prisma(
      ['migrate', 'diff', '--from-url', `"${url}"`, '--to-schema-datamodel', `"${SNAPSHOT}"`, '--exit-code'],
      { allowExit: [2] },
    );
    if (same === 2) stop('The database structure differs from 0_init, so it cannot be safely baselined.');

    if (baselineFailed) prisma(['migrate', 'resolve', '--rolled-back', BASELINE]);
    console.log(`[migrate] Structure matches. Recording ${BASELINE} as already applied (no data is touched).`);
    prisma(['migrate', 'resolve', '--applied', BASELINE]);
  } else if (!tables.has('User')) {
    console.log('[migrate] Empty database — every migration will be applied from the start.');
  }

  prisma(['migrate', 'deploy']);
}

main().catch((error) => {
  console.error('[migrate] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
