import PusherServer from 'pusher';

const LOG_PREFIX = '[backend/src/pusher.ts]';

const P_APP_ID = process.env.PUSHER_APP_ID;
const P_KEY = process.env.PUSHER_KEY;
const P_SECRET = process.env.PUSHER_SECRET;
const P_CLUSTER = process.env.PUSHER_CLUSTER;

export const isPusherConfigured = Boolean(P_APP_ID && P_KEY && P_SECRET && P_CLUSTER);

let pusherServer: PusherServer | null = null;
if (isPusherConfigured) {
  // todo: remove this log when done
  console.log(LOG_PREFIX, 'Pusher environment variables loaded successfully.');

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
    console.log(LOG_PREFIX,'Triggering Pusher event:', channel, event);
    pusherServer.trigger(channel, event, data);
};