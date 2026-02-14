import PusherServer from 'pusher';

const LOG_PREFIX = '[backend/src/pusher.ts]';

const P_APP_ID = process.env.PUSHER_APP_ID;
const P_KEY = process.env.PUSHER_KEY;
const P_SECRET = process.env.PUSHER_SECRET;
const P_CLUSTER = process.env.PUSHER_CLUSTER;

export const isPusherConfigured = Boolean(P_APP_ID && P_KEY && P_SECRET && P_CLUSTER);

// ---------- Channel scoping ----------
// Production channels are unprefixed; dev/preview get a prefix so events
// from different environments never leak to each other.
function getChannelPrefix(): string {
  const railwayEnv = (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || '').toLowerCase();
  if (railwayEnv === 'production' || process.env.NODE_ENV === 'production') return '';
  return 'dev__';
}

function scopeChannel(channel: string): string {
  const prefix = getChannelPrefix();
  if (!prefix) return channel;
  if (channel.startsWith(prefix)) return channel;
  return `${prefix}${channel}`;
}

let pusherServer: PusherServer | null = null;
if (isPusherConfigured) {
  console.log(LOG_PREFIX, 'Pusher environment variables loaded successfully.');
  console.log(LOG_PREFIX, `Channel prefix: ${getChannelPrefix() || '(none — production)'}`);

  pusherServer = new PusherServer({
    appId: P_APP_ID as string,
    key: P_KEY as string,
    secret: P_SECRET as string,
    cluster: (P_CLUSTER || 'eu') as string,
    useTLS: true,
  });
} else {
  console.warn(LOG_PREFIX, 'Pusher not configured; skipping real-time Pusher broadcasts.');
}

export const triggerEvent = (channel: string, event: string, data: unknown): void => {
    if (!pusherServer) {
      return;
    }
    const scoped = scopeChannel(channel);
    console.log(LOG_PREFIX,'Triggering Pusher event:', scoped, event);
    pusherServer.trigger(scoped, event, data);
};