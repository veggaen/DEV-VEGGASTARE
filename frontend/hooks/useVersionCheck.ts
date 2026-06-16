'use client';

import { useEffect, useState, useCallback } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const VERSION_ENDPOINT = '/api/version';

/**
 * Detects when a new version of the app has been deployed.
 * Periodically polls /api/version and compares build IDs.
 * When a mismatch is detected, surfaces an update prompt.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [initialVersion, setInitialVersion] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // A plain location.reload() can re-serve the cached document, so the new
    // deployment never actually loads (the banner appears to "do nothing").
    // Best-effort clear the Cache Storage / service-worker caches, then do a
    // cache-busting navigation so the fresh build is fetched.
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore — proceed to reload regardless */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function checkVersion() {
      try {
        const res = await fetch(VERSION_ENDPOINT, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const version = data?.buildId as string | undefined;
        if (!version) return;

        if (!initialVersion) {
          setInitialVersion(version);
        } else if (version !== initialVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network errors are fine — don't block UX
      }
    }

    // First check after 30s (gives app time to hydrate)
    const startup = setTimeout(() => {
      checkVersion();
      timer = setInterval(checkVersion, CHECK_INTERVAL);
    }, 30_000);

    return () => {
      clearTimeout(startup);
      clearInterval(timer);
    };
  }, [initialVersion]);

  return { updateAvailable, refresh };
}
