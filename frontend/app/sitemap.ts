import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.veggat.com';
  const lastModified = new Date();

  // Keep this conservative (public routes only). Add dynamic product URLs later once you
  // decide whether you want them indexed and how to fetch them safely.
  return [
    { url: siteUrl, lastModified },
    { url: `${siteUrl}/products`, lastModified },
  ];
}
