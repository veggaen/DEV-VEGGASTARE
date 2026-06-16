import { useEffect, useRef } from 'react';
import type PusherClientType from "pusher-js";
import * as PusherJsNS from "pusher-js";
import { scopeChannel } from '@/lib/pusher-channel';

const LOG_PREFIX = '[usePusher]';
const DEBUG_PUSHER = process.env.NEXT_PUBLIC_DEBUG_PUSHER === 'true';

const P_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const P_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

// pusher-js is a browser SDK. Instantiating it at module top-level ran during
// SSR — and under the production server bundle its default export resolved to
// undefined, so `new PusherClient(...)` threw "f is not a constructor",
// 500-ing every SSR page (and the whole login flow). Create it lazily, only in
// the browser, with defensive default-interop.
let pusherClient: PusherClientType | undefined;

function getPusherClient(): PusherClientType | undefined {
  if (typeof window === 'undefined') return undefined; // never on the server
  if (pusherClient) return pusherClient;
  if (!P_KEY || !P_CLUSTER) return undefined;
  const Ctor = ((PusherJsNS as unknown as { default?: unknown }).default ??
    PusherJsNS) as unknown as typeof PusherClientType;
  pusherClient = new Ctor(P_KEY, { cluster: P_CLUSTER, forceTLS: true });
  return pusherClient;
}

// Track active subscriptions to avoid duplicate logs
const activeSubscriptions = new Set<string>();

const usePusher = <T = unknown>(channelName: string, eventName: string, callback: (data: T) => void): void => {
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    const pusherClient = getPusherClient();
    if (!pusherClient || !channelName) return;

    // Scope the channel name to the current environment
    const scopedChannel = scopeChannel(channelName);
    
    const subKey = `${scopedChannel}:${eventName}`;
    const isNewSub = !activeSubscriptions.has(subKey);
    
    if (isNewSub) {
      activeSubscriptions.add(subKey);
      if (DEBUG_PUSHER) {
        console.log(`${LOG_PREFIX} +${scopedChannel}/${eventName}`);
      }
    }

    const channel = pusherClient.subscribe(scopedChannel);
    channel.bind(eventName, callback);

    // Only log subscription success once per unique channel (not per event)
    if (!hasLoggedRef.current && DEBUG_PUSHER) {
      channel.bind('pusher:subscription_succeeded', () => {
        if (!hasLoggedRef.current) {
          hasLoggedRef.current = true;
          // Only log aggregate count periodically
        }
      });
    }

    channel.bind('pusher:subscription_error', (status: any) => {
      console.error(`${LOG_PREFIX} Error on ${scopedChannel}:`, status);
    });

    return () => {
      activeSubscriptions.delete(subKey);
      channel.unbind(eventName, callback);
      channel.unsubscribe();
    };
  }, [channelName, eventName, callback]);
};

export default usePusher;