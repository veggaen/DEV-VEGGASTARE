/** @fileOverview Fail closed when Preview has no isolated database configuration. @stability stable */
export function previewDatabaseUrl(env: Record<string, string | undefined>): string {
  const selected = env.DATABASE_URL_MAINPREVIEW?.trim() || env.DATABASE_URL_MAINDEV?.trim();
  if (!selected) throw new Error('Preview requires DATABASE_URL_MAINPREVIEW or DATABASE_URL_MAINDEV; production fallback is forbidden.');
  const endpoint = (value: string) => {
    try {
      const url = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
      return url.hostname.replace(/-pooler(?=\..*\.neon\.tech$)/, '');
    } catch { throw new Error('Invalid database connection configuration; values are redacted.'); }
  };
  const target = endpoint(selected);
  if (env.DATABASE_URL_MAINLIVE && target === endpoint(env.DATABASE_URL_MAINLIVE)) {
    throw new Error('Preview database must use a separate endpoint from DATABASE_URL_MAINLIVE.');
  }
  return selected;
}
