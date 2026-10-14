import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The API address, from either variable name.
 *
 * `NEXT_PUBLIC_API_URL` is the Next.js convention, but Vercel refuses a
 * `NEXT_PUBLIC_` variable created with the Secret type. `API_URL` works with
 * either type. Whichever is set gets compiled into the build — the address is
 * public anyway, since every browser has to call it.
 *
 * API_URL wins when both exist. It is the name the deploy guide tells people to
 * set, so a stale NEXT_PUBLIC_API_URL left over from an earlier attempt must not
 * silently override it — which is exactly what happened on the first deploy.
 */
const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(apiUrl ? { env: { NEXT_PUBLIC_API_URL: apiUrl } } : {}),
  // Pin the trace root to this repo — otherwise Next walks up D:\ and picks up
  // an unrelated lockfile as the workspace root.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // The shared domain package is TypeScript source in the workspace.
  transpilePackages: ['@enhakkore/shared'],
  images: {
    remotePatterns: [
      // Demonstration photography. Replace with your own before launch — see
      // apps/api/prisma/images.ts.
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Photos uploaded by operators and travellers.
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // The same uploads while developing, when they are served by the API
      // itself because no image service is configured.
      { protocol: 'http', hostname: 'localhost', port: '4000' },
      { protocol: 'http', hostname: '127.0.0.1', port: '4000' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Media files are named by content (a new video gets a new filename), so the
  // browser can keep them for a year: returning visitors never re-download the
  // hero video.
  async headers() {
    return [
      {
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
