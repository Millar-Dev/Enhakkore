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

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const resendApiKey = process.env.RESEND_API_KEY?.trim() || null;

/**
 * Cloudinary credentials. Accepts either the single CLOUDINARY_URL that the
 * dashboard hands out (cloudinary://key:secret@cloud-name) or the three
 * variables separately, because hosting panels differ in what they accept.
 */
function cloudinaryConfig() {
  const single = process.env.CLOUDINARY_URL?.trim();
  if (single) {
    const match = single.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (!match) {
      throw new Error('CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>');
    }
    return { apiKey: match[1]!, apiSecret: match[2]!, cloudName: match[3]!.replace(/\/.*$/, '') };
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

const cloudinary = cloudinaryConfig();

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'file:./dev.db'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins,
  seedDemoData: (process.env.SEED_DEMO_DATA ?? 'true') !== 'false',
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',

  /**
   * The website's public address, used to build links inside emails. Defaults
   * to the first CORS origin — which is already the website — so a deployment
   * works without setting it separately.
   */
  appUrl: (process.env.APP_URL ?? corsOrigins[0] ?? 'http://localhost:3000').replace(/\/+$/, ''),

  /**
   * This API's own public address. Only the local file adapter needs it, to
   * build links to files it is serving itself. Render supplies RENDER_EXTERNAL_URL.
   */
  apiUrl: (process.env.API_PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(
    /\/+$/,
    '',
  ),

  email: {
    /** `resend` once an API key is present; otherwise the log-only adapter. */
    provider: resendApiKey ? ('resend' as const) : ('console' as const),
    resendApiKey,
    /**
     * Until a domain is verified in Resend, only its shared test sender works,
     * and it delivers solely to the Resend account owner's own inbox.
     */
    from: process.env.EMAIL_FROM?.trim() || 'Enhakkore <onboarding@resend.dev>',
  },

  storage: {
    /** `cloudinary` once credentials are present; otherwise files stay on disk. */
    provider: cloudinary ? ('cloudinary' as const) : ('local' as const),
    cloudinary,
    /**
     * Where the local adapter keeps files. Fine for development; on hosting the
     * disk is wiped on every deploy, which is why production needs Cloudinary.
     */
    localDir: path.resolve(__dirname, '../uploads'),
  },
};

if (env.isProduction && env.storage.provider === 'local') {
  console.warn(
    '[storage] No Cloudinary credentials set. Uploads will be written to disk and LOST on the next deploy.',
  );
}
