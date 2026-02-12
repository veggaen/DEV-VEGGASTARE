import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

const LOG_PREFIX = '[frontend/lib/pusher.ts]';

const P_APP_ID = process.env.PUSHER_APP_ID;
const P_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const P_SECRET = process.env.PUSHER_SECRET;
const P_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

// Log Pusher config status ONCE
const globalForPusherLog = globalThis as unknown as { __pusherConfigLogged?: boolean }
if (!globalForPusherLog.__pusherConfigLogged) {
  globalForPusherLog.__pusherConfigLogged = true
  if (!P_APP_ID || !P_KEY || !P_SECRET || !P_CLUSTER) {
    if (!P_APP_ID) console.error(`${LOG_PREFIX} Missing PUSHER_APP_ID`);
    if (!P_KEY) console.error(`${LOG_PREFIX} Missing PUSHER_KEY`);
    if (!P_SECRET) console.error(`${LOG_PREFIX} Missing PUSHER_SECRET`);
    if (!P_CLUSTER) console.error(`${LOG_PREFIX} Missing PUSHER_CLUSTER`);
  } else {
    console.log(`${LOG_PREFIX} Pusher configured.`);
  }
}

const pusherServer = new PusherServer({
    appId: P_APP_ID!!,
    key: P_KEY!!,
    secret: P_SECRET!!,
    cluster: P_CLUSTER!!,
    useTLS: true,
});
  
  
export { pusherServer };