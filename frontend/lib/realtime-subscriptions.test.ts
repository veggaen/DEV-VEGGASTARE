import { describe, expect, it, vi } from 'vitest';
import { createRealtimeSubscriptions } from './realtime-subscriptions';

function fixture() {
  const bindings = new Map<string, Set<(data: unknown) => void>>();
  const channel = {
    bind: vi.fn((event: string, fn: (data: unknown) => void) => { if (!bindings.has(event)) bindings.set(event, new Set()); bindings.get(event)!.add(fn); }),
    unbind: vi.fn((event: string, fn: (data: unknown) => void) => bindings.get(event)?.delete(fn)),
  };
  const client = { subscribe: vi.fn(() => channel), unsubscribe: vi.fn() };
  const load = vi.fn(async () => client), error = vi.fn();
  return { client, channel, load, error, manager: createRealtimeSubscriptions(load, error), emit: (event: string) => bindings.get(event)?.forEach(fn => fn('message')) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('owned lazy realtime subscriptions', () => {
  it('does not load without a channel and event', () => {
    const f=fixture(); f.manager.subscribe('', 'change', vi.fn())(); f.manager.subscribe('room', '', vi.fn())(); expect(f.load).not.toHaveBeenCalled();
  });
  it('keeps a shared channel until its last listener leaves', async () => {
    const f=fixture(), a=vi.fn(), b=vi.fn();
    const stopA=f.manager.subscribe('room','change',a), stopB=f.manager.subscribe('room','change',b); await flush();
    expect(f.client.subscribe).toHaveBeenCalledTimes(1); f.emit('change'); expect(a).toHaveBeenCalledOnce();expect(b).toHaveBeenCalledOnce();
    stopA();stopA();f.emit('change');expect(a).toHaveBeenCalledOnce();expect(b).toHaveBeenCalledTimes(2);expect(f.client.unsubscribe).not.toHaveBeenCalled();
    stopB();expect(f.client.unsubscribe).toHaveBeenCalledExactlyOnceWith('room');
  });
  it('owns identical callbacks separately', async () => {
    const f=fixture(), callback=vi.fn();const a=f.manager.subscribe('room','change',callback), b=f.manager.subscribe('room','change',callback);await flush();
    a();f.emit('change');expect(callback).toHaveBeenCalledOnce();b();
  });
  it('does not attach when unmounted before loading resolves', async () => {
    const f=fixture();let resolve!:(client:typeof f.client)=>void;
    const manager=createRealtimeSubscriptions(()=>new Promise(done=>{resolve=done;}));
    const stop=manager.subscribe('room','change',vi.fn());stop();resolve(f.client);await flush();expect(f.client.subscribe).not.toHaveBeenCalled();
  });
  it('does not unsubscribe a different channel',async()=>{
    const f=fixture(), a=f.manager.subscribe('one','change',vi.fn()), b=f.manager.subscribe('two','change',vi.fn());await flush();a();expect(f.client.unsubscribe).toHaveBeenCalledExactlyOnceWith('one');b();
  });
  it('contains load failures and allows the next subscription to retry',async()=>{
    const f=fixture();f.load.mockRejectedValueOnce(Error('Unavailable'));
    f.manager.subscribe('room','change',vi.fn());await flush();expect(f.error).toHaveBeenCalledOnce();
    const stop=f.manager.subscribe('room','change',vi.fn());await flush();expect(f.client.subscribe).toHaveBeenCalledOnce();stop();
  });
});
