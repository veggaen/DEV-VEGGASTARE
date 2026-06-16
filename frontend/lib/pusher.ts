import * as PusherNS from 'pusher';
import { scopeChannel } from './pusher-channel';

// `pusher` (server SDK) is CommonJS whose `module.exports` IS the constructor,
// with no `.default`. Turbopack's ESM interop on Vercel resolves
// `import PusherServer from 'pusher'` to the (undefined) `.default`, so
// `class X extends PusherServer` crashed at SSR module-eval with
// "d.default is not a constructor". Pick the callable defensively so it works
// under every bundler/interop. The type still comes from the module namespace.
type PusherResponse = PusherNS.Response;
type PusherCtor = typeof import('pusher');
const PusherServer = ((PusherNS as unknown as { default?: unknown }).default ??
  PusherNS) as unknown as PusherCtor;

const LOG_PREFIX = '[frontend/lib/pusher.ts]';

const P_APP_ID = process.env.PUSHER_APP_ID;
const P_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const P_SECRET = process.env.PUSHER_SECRET;
const P_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

// Only log errors for missing config — skip success log (re-evaluates per request in Next.js workers)
if (!P_APP_ID) console.error(`${LOG_PREFIX} Missing PUSHER_APP_ID`);
if (!P_KEY) console.error(`${LOG_PREFIX} Missing PUSHER_KEY`);
if (!P_SECRET) console.error(`${LOG_PREFIX} Missing PUSHER_SECRET`);
if (!P_CLUSTER) console.error(`${LOG_PREFIX} Missing PUSHER_CLUSTER`);

/**
 * Scoped PusherServer — automatically prefixes channel names with the
 * current environment so dev/preview events never leak to production.
 */
class ScopedPusherServer extends PusherServer {
    trigger(
        channel: string | string[],
        event: string,
        data: any,
        params?: any,
    ): Promise<PusherResponse> {
        const scoped = Array.isArray(channel)
            ? channel.map(scopeChannel)
            : scopeChannel(channel);
        return super.trigger(scoped, event, data, params);
    }
}

const pusherServer = new ScopedPusherServer({
    appId: P_APP_ID!!,
    key: P_KEY!!,
    secret: P_SECRET!!,
    cluster: P_CLUSTER!!,
    useTLS: true,
});

export { pusherServer };