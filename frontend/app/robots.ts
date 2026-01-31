import type { MetadataRoute } from 'next';

// Set to false when you're ready to launch and want search engines to index
const IS_PRIVATE_TESTING = true;

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.veggat.com';

  // During private testing, block all crawlers
  if (IS_PRIVATE_TESTING) {
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
