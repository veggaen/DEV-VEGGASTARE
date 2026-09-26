// @vitest-environment jsdom
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { AiDraftProvider, useAiDraft, useAiDraftTransfer, useAiImageDraft, useAiModelDraft } from './AiDrafts';
it('preserves each chat model, including first-save navigation, and resets on account change', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  let set: ReturnType<typeof useAiModelDraft>[1], transfer: ReturnType<typeof useAiDraftTransfer>;
  function Composer({ id }: { id: string }) {
    const [selection, setter] = useAiModelDraft(id); const move = useAiDraftTransfer();
    useEffect(() => { set = setter; transfer = move; }, [setter, move]);
    return <span>{selection.model}</span>;
  }
  const render = (id: string, account = 'one') => act(async () => root.render(<AiDraftProvider key={account}><Composer id={id} /></AiDraftProvider>));
  try {
    await render('new'); await act(async () => set({ provider: 'OPENAI', model: 'gpt-5.6-luna' }));
    await render('other'); expect(host.textContent).toBe('gemini-2.5-flash-lite');
    await act(async () => transfer('new', 'created')); await render('created'); expect(host.textContent).toBe('gpt-5.6-luna');
    await render('new'); expect(host.textContent).toBe('gemini-2.5-flash-lite');
    await render('created', 'two'); expect(host.textContent).toBe('gemini-2.5-flash-lite');
  } finally { await act(async () => root.unmount()); }
});
it('keeps image files and late upload results in the originating chat only', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  let set: ReturnType<typeof useAiImageDraft>[1], transfer: ReturnType<typeof useAiDraftTransfer>;
  function Composer({ id }: { id: string }) {
    const [images, setter] = useAiImageDraft(id); const move = useAiDraftTransfer();
    useEffect(() => { set = setter; transfer = move; }, [setter, move]);
    return <span>{images.map(image => image.file.name + ':' + (image.uploaded?.id ?? 'local')).join(',')}</span>;
  }
  const render = (id: string, account = 'one') => act(async () => root.render(<AiDraftProvider key={account}><Composer id={id} /></AiDraftProvider>));
  try {
    await render('new'); await act(async () => set([{ id: 'a', file: new File(['a'], 'alpha.png', { type: 'image/png' }) }]));
    const uploadA = set!;
    await render('other'); await act(async () => set([{ id: 'b', file: new File(['b'], 'beta.png', { type: 'image/png' }) }]));
    await act(async () => uploadA(images => images.map(image => ({ ...image, uploaded: { id: 'saved-a', sessionId: 'created', width: 50, height: 50 } }))));
    expect(host.textContent).toBe('beta.png:local');
    await act(async () => transfer('new', 'created')); await render('created'); expect(host.textContent).toBe('alpha.png:saved-a');
    await render('new'); expect(host.textContent).toBe('');
    await render('other'); expect(host.textContent).toBe('beta.png:local');
    await render('other', 'two'); expect(host.textContent).toBe('');
  } finally { await act(async () => root.unmount()); }
});
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
