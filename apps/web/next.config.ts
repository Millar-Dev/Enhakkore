import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
