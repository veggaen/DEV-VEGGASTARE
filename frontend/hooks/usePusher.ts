import { useEffect, useLayoutEffect, useRef } from 'react';
import type PusherClient from 'pusher-js';
import { scopeChannel } from '@/lib/pusher-channel';
import { createRealtimeSubscriptions } from '@/lib/realtime-subscriptions';

const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
let client: PusherClient | undefined;
let pending: Promise<PusherClient> | undefined;

// Only a configured, active subscription downloads the SDK. No lazy boundary
// around the SSR shell; concurrent initialization is shared.
async function getClient() {
  if (client) return client;
  if (!pending) pending = import('pusher-js').then(module => {
    const Constructor = (module.default ?? module) as typeof PusherClient;
    client = new Constructor(key!, { cluster: cluster!, forceTLS: true,
      channelAuthorization: { endpoint: '/api/pusher/auth', transport: 'ajax' },
    });
    return client;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
const subscriptions = createRealtimeSubscriptions(getClient);

export default function usePusher<T = unknown>(channelName: string, eventName: string, callback: (data: T) => void): void {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; }, [callback]);
  useEffect(() => {
    if (!channelName || !eventName || !key || !cluster) return;
    return subscriptions.subscribe(scopeChannel(channelName), eventName, data => latest.current(data as T));
  }, [channelName, eventName]);
}
