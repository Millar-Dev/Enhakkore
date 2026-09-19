import { env } from '../env';

const isPostgres = /^postgres(ql)?:\/\//.test(env.databaseUrl);

/**
 * A case-insensitive "contains" filter that behaves the same on both databases.
 *
 * SQLite's LIKE already ignores ASCII case, and Prisma rejects `mode` there.
 * PostgreSQL compares case-sensitively unless told otherwise — so without this,
 * searching "zanzibar" on the live site found nothing while "Zanzibar" found
 * two trips, and local development (SQLite) never showed the difference.
 *
 * The cast keeps the type-checker happy against a client generated for SQLite;
 * at runtime on Postgres the client is generated for Postgres and accepts `mode`.
 */
export function textContains(value: string): { contains: string } {
  return (isPostgres ? { contains: value, mode: 'insensitive' } : { contains: value }) as { contains: string };
}
