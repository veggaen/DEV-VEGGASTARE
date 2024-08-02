import PusherServer from 'pusher';

const LOG_PREFIX = '[backend/src/pusher.ts]';

const P_APP_ID = process.env.PUSHER_APP_ID;
const P_KEY = process.env.PUSHER_KEY;
const P_SECRET = process.env.PUSHER_SECRET;
const P_CLUSTER = process.env.PUSHER_CLUSTER;

if (!P_APP_ID || !P_KEY || !P_SECRET || !P_CLUSTER) {
    throw new Error(`${LOG_PREFIX} 'Pusher environment variables are not set!'`);
}

// todo: remove this log when done
console.log(LOG_PREFIX, 'Pusher environment variables loaded successfully.');

const pusherServer = new PusherServer({
  appId: P_APP_ID,
  key: P_KEY,
  secret: P_SECRET,
  cluster: P_CLUSTER || 'eu',
  useTLS: true,
});

export const triggerEvent = (channel: string, event: string, data: any) => {
    console.log(LOG_PREFIX,'Triggering Pusher event:', channel, event, data);
    pusherServer.trigger(channel, event, data);
};