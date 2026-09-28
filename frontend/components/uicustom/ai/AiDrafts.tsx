'use client';
import { createContext, useCallback, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ChatImageView } from '@/lib/ai-chat/image-policy';
import type { AiProvider } from '@/lib/ai-models';
export type DraftImage = { id: string; file: File; uploaded?: ChatImageView & { sessionId: string } };
type Selection = { provider: AiProvider; model: string };
const defaultSelection: Selection = { provider: 'GOOGLE', model: 'gemini-2.5-flash-lite' };

// Memory only: unsent text never goes to URLs, analytics, storage, or the server.
// The account-keyed provider is discarded on sign-out or account changes.
const DraftContext = createContext<{ drafts: Record<string, string>; images: Record<string, DraftImage[]>; models: Record<string, Selection>; setModel: (id: string, selection: SetStateAction<Selection>) => void; setImages: (id: string, value: SetStateAction<DraftImage[]>) => void; set: (id: string, value: SetStateAction<string>) => void; transfer: (from: string, to: string) => void } | null>(null);
export function AiDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [images, updateImages] = useState<Record<string, DraftImage[]>>({});
  const [models, updateModels] = useState<Record<string, Selection>>({});
  const setModel = useCallback((id: string, selection: SetStateAction<Selection>) => {
    updateModels(previous => ({ ...previous, [id]: typeof selection === 'function' ? selection(previous[id] ?? defaultSelection) : selection }));
  }, []);
  const setImages = useCallback((id: string, value: SetStateAction<DraftImage[]>) => {
    updateImages(previous => {
      const next = typeof value === 'function' ? value(previous[id] ?? []) : value;
      // Bound retained File memory across all open conversation drafts.
      const others = Object.entries(previous).filter(([key]) => key !== id).reduce((count, [, files]) => count + files.length, 0);
      return { ...previous, [id]: next.slice(0, Math.max(0, Math.min(2, 10 - others))) };
    });
  }, []);
  const set = useCallback((id: string, value: SetStateAction<string>) => {
    setDrafts(previous => ({ ...previous, [id]: typeof value === 'function' ? value(previous[id] ?? '') : value }));
  }, []);
  const transfer = useCallback((from: string, to: string) => {
    setDrafts(previous => ({ ...previous, [to]: previous[from] ?? '', [from]: '' }));
    updateImages(previous => ({ ...previous, [to]: previous[from] ?? [], [from]: [] }));
    updateModels(previous => ({ ...previous, [to]: previous[from] ?? defaultSelection, [from]: defaultSelection }));
  }, []);
  return <DraftContext value={{ drafts, images, models, setModel, setImages, set, transfer }}>{children}</DraftContext>;
}
export function useAiModelDraft(id: string): [Selection, Dispatch<SetStateAction<Selection>>] {
  const context = useContext(DraftContext);
  if (!context) throw new Error('AI drafts require an account-scoped provider');
  const { setModel } = context;
  const set = useCallback<Dispatch<SetStateAction<Selection>>>(value => setModel(id, value), [id, setModel]);
  return [context.models[id] ?? defaultSelection, set];
}
export function useAiImageDraft(id: string): [DraftImage[], Dispatch<SetStateAction<DraftImage[]>>, number] {
  const context = useContext(DraftContext);
  if (!context) throw new Error('AI drafts require an account-scoped provider');
  const { setImages } = context;
  const set = useCallback<Dispatch<SetStateAction<DraftImage[]>>>(value => setImages(id, value), [id, setImages]);
  return [context.images[id] ?? [], set, Object.values(context.images).reduce((count, images) => count + images.length, 0)];
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
