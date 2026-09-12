import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

// A weak signing key is tolerable while developing locally but must never ship.
const jwtSecret = required('JWT_SECRET', isProduction ? undefined : 'dev-only-change-me');
if (isProduction && jwtSecret === 'dev-only-change-me') {
  throw new Error('JWT_SECRET is still the development placeholder. Set a real secret.');
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'file:./dev.db'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  seedDemoData: (process.env.SEED_DEMO_DATA ?? 'true') !== 'false',
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
};
