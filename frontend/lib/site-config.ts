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

function readNonEmptyEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

// Access gate configuration
export const ACCESS_GATE_CONFIG = {
  // Env override:
  // - GATE_STATUS=true  => gate enabled
  // - GATE_STATUS=false => gate disabled
  // If not set, defaults to private-mode behavior.
  enabled: (() => {
    const envEnabled = parseBooleanEnv(process.env.GATE_STATUS);
    const enabled = envEnabled ?? IS_PRIVATE_MODE;
    const password =
      readNonEmptyEnv(process.env.GATE_PASSWORD) ??
      readNonEmptyEnv(process.env.ACCESS_GATE_PASSWORD) ??
      'MainAdc123';

    // Fail-safe: never enable the gate with an empty password.
    return enabled && password.length > 0;
  })(),
  password:
    readNonEmptyEnv(process.env.GATE_PASSWORD) ??
    readNonEmptyEnv(process.env.ACCESS_GATE_PASSWORD) ??
    'MainAdc123',
  cookieName: 'veggastare_access',
  // Important: NextAuth/Auth.js OAuth callbacks must not be gated.
  bypassRoutes: ['/gate', '/api/access-gate', '/api/auth', '/privacy', '/terms', '/info'],
};

// SEO configuration
export const SEO_CONFIG = {
  allowCrawlers: IS_PUBLIC_MODE,
  generateSitemap: IS_PUBLIC_MODE,
};
