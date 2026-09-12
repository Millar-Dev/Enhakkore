#!/usr/bin/env node
/**
 * Keeps the Prisma datasource provider in step with DATABASE_URL.
 *
 * SQLite is the zero-setup local default, but it cannot run on a host — the
 * filesystem is ephemeral. Rather than keeping two schema files that drift, or
 * asking anyone to remember to edit a line before deploying, this reads the
 * connection string and sets the provider to match.
 *
 *   file:./dev.db            → sqlite
 *   postgresql://… | postgres://… → postgresql
 *
 * It runs before generate, push and build. Locally it is a no-op.
 */

const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SCHEMA = path.resolve(__dirname, '../prisma/schema.prisma');

function providerFor(url) {
  if (!url) return null;
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  if (url.startsWith('file:')) return 'sqlite';
  if (url.startsWith('mysql://')) return 'mysql';
  return null;
}

const url = process.env.DATABASE_URL;
const wanted = providerFor(url);

if (!wanted) {
  // No usable DATABASE_URL — leave the schema exactly as committed. Prisma will
  // give a clearer error than anything invented here.
  console.log('[datasource] DATABASE_URL not set or unrecognised; leaving schema unchanged.');
  process.exit(0);
}

const schema = fs.readFileSync(SCHEMA, 'utf8');

// Only touch the provider line inside the `datasource db { … }` block, so a
// `generator` block or a comment mentioning "provider" is never rewritten.
const updated = schema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/,
  `$1"${wanted}"`,
);

if (updated === schema) {
  console.log(`[datasource] provider already "${wanted}".`);
  process.exit(0);
}

fs.writeFileSync(SCHEMA, updated);
console.log(`[datasource] provider set to "${wanted}" from DATABASE_URL.`);
