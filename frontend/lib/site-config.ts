/**
 * Site Mode Configuration
 * 
 * Controls whether the site is in private testing mode or public.
 * When ready to launch, change SITE_MODE to 'public'.
 * 
 * PRIVATE MODE:
 * - Access gate enabled (password required)
 * - robots.txt blocks all crawlers
 * - No SEO indexing
 * 
 * PUBLIC MODE:
 * - No access gate
 * - robots.txt allows crawlers
 * - Full SEO indexing
 */

export type SiteMode = 'private' | 'public';

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CHANGE THIS WHEN READY TO LAUNCH
// ═══════════════════════════════════════════════════════════════════════════
export const SITE_MODE: SiteMode = 'private';
// ═══════════════════════════════════════════════════════════════════════════

// Derived flags for convenience
export const IS_PRIVATE_MODE: boolean = SITE_MODE === 'private';
export const IS_PUBLIC_MODE: boolean = !IS_PRIVATE_MODE;

// Access gate configuration
export const ACCESS_GATE_CONFIG = {
  enabled: IS_PRIVATE_MODE,
  password: 'MainAdc123', // Change this password as needed
  cookieName: 'veggastare_access',
  // Important: NextAuth/Auth.js OAuth callbacks must not be gated.
  bypassRoutes: ['/gate', '/api/access-gate', '/api/auth', '/privacy', '/terms', '/info'],
};

// SEO configuration
export const SEO_CONFIG = {
  allowCrawlers: IS_PUBLIC_MODE,
  generateSitemap: IS_PUBLIC_MODE,
};
