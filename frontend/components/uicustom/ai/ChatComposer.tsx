'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowUp, Square, Plus } from 'lucide-react';

export function ChatComposer({ value, onChange, onSend, onStop, busy = false, disabled = false, toolbar, guidance, attachments, onFiles, hasAttachments = false }: {
  value: string; onChange: (value: string) => void; onSend: () => void; onStop?: () => void;
  busy?: boolean; disabled?: boolean; toolbar?: ReactNode; guidance?: ReactNode;
  attachments?: ReactNode; onFiles?: (files: File[]) => void; hasAttachments?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null), guidanceId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const hasContent = !!value.trim() || hasAttachments;
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${Math.min(input.current.scrollHeight, 168)}px`;
  }, [value]);
  return <div className="w-full min-w-0" data-ai-composer>
    <form onSubmit={event => { event.preventDefault(); if (!busy && !disabled && hasContent) onSend(); }}
      onPaste={event => { if (onFiles && !busy && event.clipboardData.files.length) onFiles(Array.from(event.clipboardData.files)); }}
      onDragOver={event => { if (onFiles && event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
      onDrop={event => { if (onFiles && event.dataTransfer.files.length) { event.preventDefault(); if (!busy) onFiles(Array.from(event.dataTransfer.files)); } }}
      className="ai-composer-surface rounded-3xl border border-border bg-foreground/[0.05] p-2 shadow-sm [@media(max-height:500px)_and_(min-width:640px)]:flex [@media(max-height:500px)_and_(min-width:640px)]:items-end [@media(max-height:500px)_and_(min-width:640px)]:gap-2">
      <textarea ref={input} name="ai-message" autoComplete="off" aria-label="AI message" aria-describedby={guidance ? guidanceId : undefined}
        value={value} onChange={event => onChange(event.target.value)} placeholder="Ask anything…" rows={2} maxLength={4000}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && !disabled && hasContent) onSend(); } }}
        className="block max-h-42 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-base leading-7 outline-none placeholder:text-muted-foreground [@media(max-height:500px)_and_(min-width:640px)]:min-h-11 [@media(max-height:500px)_and_(min-width:640px)]:max-h-11 [@media(max-height:500px)_and_(min-width:640px)]:min-w-0 [@media(max-height:500px)_and_(min-width:640px)]:flex-1" />
      {attachments}
      <div className="flex min-w-0 items-center justify-between gap-2 [@media(max-height:500px)_and_(min-width:640px)]:shrink-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {onFiles && <><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="Choose chat images" onChange={event => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} aria-label="Attach images" title="Attach images · JPG, PNG, WebP · 4 MB each" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"><Plus size={20} aria-hidden="true" /></button></>}
          {toolbar}</div>
        {busy && onStop ? <button type="button" onClick={onStop} aria-label="Stop response" title="Stop response" className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background focus-visible:ring-2 focus-visible:ring-ring"><Square size={16} fill="currentColor" aria-hidden="true" /></button>
          : <button type="submit" disabled={busy || disabled || !hasContent} aria-label="Send message" title="Send message" className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><ArrowUp size={20} aria-hidden="true" /></button>}
      </div>
    </form>
    {guidance && <div id={guidanceId} className="mt-2 px-2 text-xs leading-5 text-muted-foreground">{guidance}</div>}
  </div>;
}
