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

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 ACCESS GATE PASSWORD
// ═══════════════════════════════════════════════════════════════════════════
// Reads from GATE_PASSWORD env var. No hardcoded fallback.
// Edge middleware can read env vars in Next.js 16+, so this is safe.
// To disable the gate entirely, set GATE_STATUS=false in your env vars.
const GATE_PASSWORD = process.env.GATE_PASSWORD?.trim() || '';
if (!GATE_PASSWORD && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] GATE_PASSWORD env var is required in production!');
}
// ═══════════════════════════════════════════════════════════════════════════

// Cookie domain: only set on production domains, never on localhost
const COOKIE_DOMAIN = (() => {
  const envDomain = process.env.ACCESS_GATE_COOKIE_DOMAIN?.trim();
  // Don't set domain on localhost — browser won't send cookies across domains
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return undefined;
  }
  // For server-side, check NODE_ENV
  if (process.env.NODE_ENV === 'development') {
    return undefined;
  }
  return envDomain || undefined;
})();

// Access gate configuration
export const ACCESS_GATE_CONFIG = {
  // Env override:
  // - GATE_STATUS=true  => gate enabled
  // - GATE_STATUS=false => gate disabled
  // If not set, defaults to private-mode behavior.
  enabled: (() => {
    const envEnabled = parseBooleanEnv(process.env.GATE_STATUS);
    const enabled = envEnabled ?? IS_PRIVATE_MODE;
    // Fail-safe: never enable the gate with an empty password.
    return enabled && GATE_PASSWORD.length > 0;
  })(),
  password: GATE_PASSWORD,
  cookieName: 'veggastare_access',
  cookieDomain: COOKIE_DOMAIN,
  // Important: NextAuth/Auth.js OAuth callbacks and webhooks must not be gated.
  bypassRoutes: ['/gate', '/api/access-gate', '/api/auth', '/api/webhooks', '/privacy', '/terms', '/info', '/poll-test'],
};

// SEO configuration
export const SEO_CONFIG = {
  allowCrawlers: IS_PUBLIC_MODE,
  generateSitemap: IS_PUBLIC_MODE,
};
