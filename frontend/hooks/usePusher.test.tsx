// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>{
  vi.stubEnv('NEXT_PUBLIC_PUSHER_KEY','qa-public-key');vi.stubEnv('NEXT_PUBLIC_PUSHER_CLUSTER','eu');
  return {subscribe:vi.fn(),stop:vi.fn()};
});
vi.mock('@/lib/realtime-subscriptions',()=>({createRealtimeSubscriptions:()=>({subscribe:mocks.subscribe})}));
vi.mock('@/lib/pusher-channel',()=>({scopeChannel:(name:string)=>'preview__'+name}));
import usePusher from './usePusher';
let root:Root,host:HTMLDivElement;
function Listener({name='room',event='change',callback}:{name?:string;event?:string;callback:(value:unknown)=>void}){usePusher(name,event,callback);return null;}
beforeEach(()=>{
  vi.clearAllMocks();mocks.subscribe.mockReturnValue(mocks.stop);
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('does not subscribe for an anonymous empty channel',async()=>{
  await act(async()=>root.render(<Listener name="" callback={vi.fn()}/>));expect(mocks.subscribe).not.toHaveBeenCalled();
});
it('uses the latest committed callback without subscription churn',async()=>{
  const first=vi.fn(),second=vi.fn();await act(async()=>root.render(<Listener callback={first}/>));
  const handler=mocks.subscribe.mock.calls[0][2];handler('first');expect(first).toHaveBeenCalledWith('first');
  await act(async()=>root.render(<Listener callback={second}/>));handler('next');expect(second).toHaveBeenCalledWith('next');
  expect(mocks.subscribe).toHaveBeenCalledTimes(1);expect(mocks.stop).not.toHaveBeenCalled();
});
it('cleans up the old identity and retains environment scoping',async()=>{
  const callback=vi.fn();await act(async()=>root.render(<Listener callback={callback}/>));
  await act(async()=>root.render(<Listener name="other" callback={callback}/>));expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.subscribe.mock.calls.map(call=>call.slice(0,2))).toEqual([['preview__room','change'],['preview__other','change']]);
});
