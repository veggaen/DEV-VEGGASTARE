/** Own individual listeners; never remove a sibling's shared channel. */
type Handler = (data: unknown) => void;
interface Channel {
  bind(event: string, handler: Handler): unknown;
  unbind(event: string, handler: Handler): unknown;
}
interface Client {
  subscribe(name: string): Channel;
  unsubscribe(name: string): unknown;
}

export function createRealtimeSubscriptions(load: () => Promise<Client>, onError = () => console.warn('Realtime updates unavailable; refresh to retry.')) {
  const channels = new Map<string, { channel: Channel; client: Client; count: number }>();
  return {
    subscribe(name: string, event: string, handler: Handler) {
      let disposed = false;
      let detach: (() => void) | undefined;
      if (name && event) void load().then(client => {
        if (disposed) return;
        let entry = channels.get(name);
        if (!entry) {
          entry = { channel: client.subscribe(name), client, count: 0 };
          channels.set(name, entry);
        }
        const owned = entry;
        const listener: Handler = data => { if (!disposed) handler(data); };
        owned.channel.bind(event, listener);
        owned.count++;
        detach = () => {
          owned.channel.unbind(event, listener);
          owned.count--;
          if (owned.count === 0) {
            channels.delete(name);
            owned.client.unsubscribe(name);
          }
        };
      }).catch(() => { if (!disposed) onError(); });
      return () => { if (disposed) return; disposed = true; detach?.(); };
    },
  };
}
