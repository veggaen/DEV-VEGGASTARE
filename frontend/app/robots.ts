import type { MetadataRoute } from 'next';
import { SEO_CONFIG } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.veggat.com';

  // During private testing, block all crawlers
  if (!SEO_CONFIG.allowCrawlers) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  // Production: allow indexing
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
