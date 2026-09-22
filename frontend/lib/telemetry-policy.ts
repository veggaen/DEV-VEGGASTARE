/** @fileOverview Consent and URL minimization for optional telemetry. @stability stable */
export const CONSENT_STORAGE_KEY = "veggat:cookieConsent";
export const CONSENT_CHANGED_EVENT = "veggat:cookie-consent-changed";

export function allowsAnalytics(raw: string | null): boolean {
  try {
    const consent = JSON.parse(raw ?? "null");
    return consent?.version === 1 && consent?.analytics === true;
  } catch {
    return false;
  }
}

export function sanitizeTelemetryUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return null;
    // Never send OAuth codes, verification tokens, search terms, or fragments.
    url.search = "";
    url.hash = "";
    // Keep route-level measurements, not account/conversation/order identifiers.
    url.pathname = url.pathname.replace(
      /^\/(ai|conversations|profile|order-confirmation|trade)\/[^/]+/,
      "/$1/[id]",
    );
    return url.toString();
  } catch {
    return null;
  }
}
