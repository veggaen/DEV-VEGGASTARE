// @vitest-environment jsdom
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { AiDraftProvider, useAiDraft, useAiDraftTransfer } from './AiDrafts';
it('keeps drafts separate across navigation and resets them on account change', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  let set: ReturnType<typeof useAiDraft>[1];
  function Composer({ id }: { id: string }) { const [value, setter] = useAiDraft(id); useEffect(() => { set = setter; }, [setter]); return <span>{value}</span>; }
  const render = (id: string, account = 'one') => act(async () => root.render(<AiDraftProvider key={account}><Composer id={id} /></AiDraftProvider>));
  try {
    await render('a'); await act(async () => set('Draft A'));
    const restoreA = set!;
    await render('b'); expect(host.textContent).toBe(''); await act(async () => set('Draft B'));
    await act(async () => restoreA(current => current || 'Late A'));
    expect(host.textContent).toBe('Draft B');
    await render('a'); expect(host.textContent).toBe('Draft A');
    await render('b'); expect(host.textContent).toBe('Draft B');
    await render('a', 'two'); expect(host.textContent).toBe('');
  } finally { await act(async () => root.unmount()); }
});

it('moves a follow-up draft into the newly saved conversation only', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  let set: ReturnType<typeof useAiDraft>[1], transfer: ReturnType<typeof useAiDraftTransfer>;
  function Composer({ id }: { id: string }) { const [value, setter] = useAiDraft(id); const move = useAiDraftTransfer(); useEffect(() => { set = setter; transfer = move; }, [setter, move]); return <span>{value}</span>; }
  const render = (id: string) => act(async () => root.render(<AiDraftProvider><Composer id={id} /></AiDraftProvider>));
  try {
    await render('other'); await act(async () => set('Other chat'));
    await render('new'); await act(async () => set('Follow-up'));
    await act(async () => transfer('new', 'created'));
    expect(host.textContent).toBe('');
    await render('created'); expect(host.textContent).toBe('Follow-up');
    await render('other'); expect(host.textContent).toBe('Other chat');
  } finally { await act(async () => root.unmount()); }
});
