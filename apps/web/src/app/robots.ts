import type { MetadataRoute } from 'next';

/** The control centre, accounts and setup are never indexed. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api'] }] };
}
