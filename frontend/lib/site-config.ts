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
// IMPORTANT: This is hardcoded because Edge middleware (proxy.ts) cannot
// reliably read server-only env vars at runtime in some deployments (Vercel).
// To change the password, update this constant and redeploy.
// To disable the gate entirely, set GATE_STATUS=false in your env vars.
const GATE_PASSWORD_HARDCODED = 'MainAdc123';
// ═══════════════════════════════════════════════════════════════════════════

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
    return enabled && GATE_PASSWORD_HARDCODED.length > 0;
  })(),
  password: GATE_PASSWORD_HARDCODED,
  cookieName: 'veggastare_access',
  // Important: NextAuth/Auth.js OAuth callbacks and webhooks must not be gated.
  bypassRoutes: ['/gate', '/api/access-gate', '/api/auth', '/api/webhooks', '/privacy', '/terms', '/info', '/poll-test'],
};

// SEO configuration
export const SEO_CONFIG = {
  allowCrawlers: IS_PUBLIC_MODE,
  generateSitemap: IS_PUBLIC_MODE,
};
