import { useEffect, useRef } from 'react';
import PusherClient from "pusher-js";

const LOG_PREFIX = '[usePusher]';
const DEBUG_PUSHER = process.env.NEXT_PUBLIC_DEBUG_PUSHER === 'true';

const P_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const P_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

let pusherClient: PusherClient | undefined;

if (!pusherClient) {
  pusherClient = new PusherClient(P_KEY!, {
    cluster: P_CLUSTER!,
    forceTLS: true,
  });
}

// Track active subscriptions to avoid duplicate logs
const activeSubscriptions = new Set<string>();

const usePusher = <T = unknown>(channelName: string, eventName: string, callback: (data: T) => void): void => {
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    if (!pusherClient || !channelName) return;
    
    const subKey = `${channelName}:${eventName}`;
    const isNewSub = !activeSubscriptions.has(subKey);
    
    if (isNewSub) {
      activeSubscriptions.add(subKey);
      if (DEBUG_PUSHER) {
        console.log(`${LOG_PREFIX} +${channelName}/${eventName}`);
      }
    }

    const channel = pusherClient.subscribe(channelName);
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
      console.error(`${LOG_PREFIX} Error on ${channelName}:`, status);
    });

    return () => {
      activeSubscriptions.delete(subKey);
      channel.unbind(eventName, callback);
      channel.unsubscribe();
    };
  }, [channelName, eventName, callback]);
};

export default usePusher;