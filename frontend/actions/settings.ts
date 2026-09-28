'use server';

import { headers } from 'next/headers';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';
import { saveAccountSettings, AccountSettingsError } from '@/lib/account-settings';
import type { AccountSettingsResult } from '@/lib/account-settings-policy';

/** Treat every argument as untrusted, even when the caller is our own form. */
export async function settings(raw: unknown): Promise<AccountSettingsResult> {
  try {
    const actor = await MyLibUserAuth();
    if (!actor?.id) return { error: 'Sign in to update your settings.' };
    if (isDemoUserId(actor.id) || actor.isImpersonating) return { error: 'Use your own account to change account settings.' };
    const h = await headers(), value = h.get('origin');
    let origin: URL;
    try { origin = new URL(value ?? ''); } catch { return { error: 'Open Settings on this site and try again.' }; }
    if (origin.origin !== value || !['https:', 'http:'].includes(origin.protocol)
      || origin.host !== (h.get('x-forwarded-host') ?? h.get('host'))) return { error: 'Open Settings on this site and try again.' };
    if (!await allowAuthAttempt('account-settings', actor.id)) return { error: AUTH_RETRY_MESSAGE };
    return await saveAccountSettings(actor.id, origin.origin, raw);
  } catch (error) {
    return { error: error instanceof AccountSettingsError ? error.message : 'The change could not be confirmed. Reload Settings before trying again.' };
  }
}
