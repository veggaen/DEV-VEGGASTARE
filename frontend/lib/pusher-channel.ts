/**
 * Pusher channel scoping by environment.
 *
 * Production channels are unprefixed (backward-compatible).
 * Preview deployments get "preview__" prefix.
 * Local development gets "dev__" prefix.
 *
 * This prevents dev/preview Pusher events from leaking into production
 * (and vice-versa), since all environments share the same Pusher app.
 */

const LOG_PREFIX = '[pusher-channel]';

function getChannelPrefix(): string {
    // NEXT_PUBLIC_VERCEL_ENV is exposed via next.config.mjs from Vercel's VERCEL_ENV
    const vercelEnv =
        process.env.NEXT_PUBLIC_VERCEL_ENV ||
        process.env.VERCEL_ENV ||
        '';

    if (vercelEnv === 'production') return '';
    if (vercelEnv === 'preview') return 'preview__';

    // Fallback for non-Vercel environments (e.g. standalone prod build)
    if (process.env.NODE_ENV === 'production') return '';

    // Local development
    return 'dev__';
}

/**
 * Prefix a Pusher channel name with the current environment scope.
 * Production channels are returned unchanged.
 */
export function scopeChannel(channel: string): string {
    const prefix = getChannelPrefix();
    const explicitPrivate = channel.startsWith('private-');
    let name = explicitPrivate ? channel.slice(8) : channel;
    if (prefix && name.startsWith(prefix)) name = name.slice(prefix.length);
    const restricted = explicitPrivate || /^(ConversationChannel_|user_)/.test(name);
    return `${restricted ? 'private-' : ''}${prefix}${name}`;
}

/** Accept only a canonical, current-environment channel from our narrow allowlist. */
export function authorizedChannelTarget(channel: string): { kind: 'conversation' | 'user'; id: string } | null {
    const match = /^private-(?:(?:preview|dev)__)?(ConversationChannel_|user_)([a-zA-Z0-9_-]{1,128})$/.exec(channel);
    if (!match || scopeChannel(`${match[1]}${match[2]}`) !== channel) return null;
    return { kind: match[1] === 'ConversationChannel_' ? 'conversation' : 'user', id: match[2] };
}

// Log once at module load so we know which scope is active
if (typeof window === 'undefined') {
    // Server-side only — avoid noisy client logs
    const prefix = getChannelPrefix();
    console.log(
        LOG_PREFIX,
        `Channel prefix: ${prefix ? `"${prefix}"` : '(none — production)'}`
    );
}
