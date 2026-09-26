'use client';
import { createContext, useCallback, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

// Memory only: unsent text never goes to URLs, analytics, storage, or the server.
// The account-keyed provider is discarded on sign-out or account changes.
const DraftContext = createContext<{ drafts: Record<string, string>; set: (id: string, value: SetStateAction<string>) => void; transfer: (from: string, to: string) => void } | null>(null);
export function AiDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const set = useCallback((id: string, value: SetStateAction<string>) => {
    setDrafts(previous => ({ ...previous, [id]: typeof value === 'function' ? value(previous[id] ?? '') : value }));
  }, []);
  const transfer = useCallback((from: string, to: string) => {
    setDrafts(previous => ({ ...previous, [to]: previous[from] ?? '', [from]: '' }));
  }, []);
  return <DraftContext value={{ drafts, set, transfer }}>{children}</DraftContext>;
}
export function useAiDraftTransfer() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('AI drafts require an account-scoped provider');
  return context.transfer;
}
export function useAiDraft(id: string): [string, Dispatch<SetStateAction<string>>] {
  const context = useContext(DraftContext);
  if (!context) throw new Error('AI drafts require an account-scoped provider');
  const { set } = context;
  const setDraft = useCallback<Dispatch<SetStateAction<string>>>(value => set(id, value), [id, set]);
  return [context.drafts[id] ?? '', setDraft];
}
