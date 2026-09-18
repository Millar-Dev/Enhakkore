import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The API address, from either variable name.
 *
 * `NEXT_PUBLIC_API_URL` is the Next.js convention, but Vercel refuses a
 * `NEXT_PUBLIC_` variable created with the Secret type. `API_URL` works with
 * either type. Whichever is set gets compiled into the build — the address is
 * public anyway, since every browser has to call it.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(apiUrl ? { env: { NEXT_PUBLIC_API_URL: apiUrl } } : {}),
  // Pin the trace root to this repo — otherwise Next walks up D:\ and picks up
  // an unrelated lockfile as the workspace root.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // The shared domain package is TypeScript source in the workspace.
  transpilePackages: ['@enhakkore/shared'],
  images: {
    // Demonstration photography only. Replace with your own CDN host before
    // launch — see apps/api/prisma/images.ts.
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
    formats: ['image/avif', 'image/webp'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
