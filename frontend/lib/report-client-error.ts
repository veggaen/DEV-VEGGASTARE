'use client';

type Consent = {
  version?: number;
  necessary?: boolean;
  analytics?: boolean;
  marketing?: boolean;
  updatedAt?: string;
  source?: 'localStorage' | 'missing';
};

const STORAGE_KEY = 'veggat:cookieConsent';

function readConsentSafe(): Consent {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { source: 'missing' };
    const parsed = JSON.parse(raw) as Partial<Consent>;
    return {
      version: typeof parsed.version === 'number' ? parsed.version : undefined,
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      source: 'localStorage',
    };
  } catch {
    return { source: 'missing' };
  }
}

function shouldReport(): boolean {
  // Default ON unless user explicitly disabled optional tracking.
  // We tie this to the cookie banner's Analytics toggle for now.
  const consent = readConsentSafe();
  if (consent.source === 'missing') return true;
  return consent.analytics !== false;
}

export function reportClientError(
  error: unknown,
  meta?: Record<string, unknown>
) {
  try {
    if (typeof window === 'undefined') return;
    if (!shouldReport()) return;

    const err = error instanceof Error ? error : new Error(String(error));

    const payload = {
      message: err.message || 'Unknown error',
      name: err.name || null,
      stack: err.stack || null,
      // Next.js app error boundaries sometimes include a digest
      digest: (err as Error & { digest?: string }).digest ?? null,
      href: window.location.href,
      pathname: window.location.pathname,
      userAgent: navigator.userAgent,
      // best-effort theme (next-themes sets it on <html data-theme> or class)
      theme: (document.documentElement.classList.contains('dark') ? 'dark' : 'light') as 'dark' | 'light',
      consent: readConsentSafe(),
      meta: meta ?? null,
    };

    const json = JSON.stringify(payload);

    // Prefer sendBeacon when available (non-blocking; survives navigation)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      navigator.sendBeacon('/api/client-errors', blob);
      return;
    }

    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never crash while reporting an error.
  }
}
