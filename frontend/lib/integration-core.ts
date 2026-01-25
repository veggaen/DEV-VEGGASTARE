function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Base URL for the standalone Integration Core backend service.
 *
 * - Browser-safe: uses NEXT_PUBLIC_* env var.
 * - Local dev fallback: http://localhost:3001
 */
export function getIntegrationCoreBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_INTEGRATION_CORE_URL;
  if (env && env.trim()) return normalizeBaseUrl(env);

  // Reasonable defaults for template/local dev.
  if (process.env.NODE_ENV === "development") return "http://localhost:3001";
  return "";
}
