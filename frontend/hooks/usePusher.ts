import { useEffect } from 'react';
import PusherClient from "pusher-js";

const LOG_PREFIX = '[frontend/hooks/usePusher.js]';

const P_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const P_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

let pusherClient: PusherClient | undefined;

if (!pusherClient) {
  pusherClient = new PusherClient(P_KEY!, {
    cluster: P_CLUSTER!,
    forceTLS: true,
  });
}

const usePusher = <T = unknown>(channelName: string, eventName: string, callback: (data: T) => void): void => {
  useEffect(() => {
    if (!pusherClient || !channelName) return;
    console.log(`${LOG_PREFIX} Subscribing to channel ${channelName} and event ${eventName}`);
    const channel = pusherClient.subscribe(channelName);
    channel.bind(eventName, callback);

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`${LOG_PREFIX} Successfully subscribed to channel ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (status: any) => {
      console.error(`${LOG_PREFIX} Error subscribing to channel ${channelName}:`, status);
    });

    return () => {
      console.log(`${LOG_PREFIX} Unsubscribing from channel ${channelName} and event ${eventName}`);
      channel.unbind(eventName, callback);
      channel.unsubscribe();
    };
  }, [channelName, eventName, callback]);
};

export default usePusher;