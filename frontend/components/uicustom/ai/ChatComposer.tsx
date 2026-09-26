'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowUp, Square } from 'lucide-react';

export function ChatComposer({ value, onChange, onSend, onStop, busy = false, disabled = false, toolbar, guidance }: {
  value: string; onChange: (value: string) => void; onSend: () => void; onStop?: () => void;
  busy?: boolean; disabled?: boolean; toolbar?: ReactNode; guidance?: ReactNode;
}) {
  const input = useRef<HTMLTextAreaElement>(null), guidanceId = useId();
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${Math.min(input.current.scrollHeight, 168)}px`;
  }, [value]);
  return <div className="w-full min-w-0" data-ai-composer>
    <form onSubmit={event => { event.preventDefault(); if (!busy && !disabled && value.trim()) onSend(); }}
      className="rounded-3xl border border-border bg-muted/40 p-2 shadow-sm focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/20 [@media(max-height:500px)_and_(min-width:640px)]:flex [@media(max-height:500px)_and_(min-width:640px)]:items-end [@media(max-height:500px)_and_(min-width:640px)]:gap-2">
      <textarea ref={input} name="ai-message" autoComplete="off" aria-label="AI message" aria-describedby={guidance ? guidanceId : undefined}
        value={value} onChange={event => onChange(event.target.value)} placeholder="Ask anything…" rows={2} maxLength={4000}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && !disabled && value.trim()) onSend(); } }}
        className="block max-h-42 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-base leading-7 outline-none placeholder:text-muted-foreground [@media(max-height:500px)_and_(min-width:640px)]:min-h-11 [@media(max-height:500px)_and_(min-width:640px)]:max-h-11 [@media(max-height:500px)_and_(min-width:640px)]:min-w-0 [@media(max-height:500px)_and_(min-width:640px)]:flex-1" />
      <div className="flex min-w-0 items-center justify-between gap-2 [@media(max-height:500px)_and_(min-width:640px)]:shrink-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1">{toolbar}</div>
        {busy && onStop ? <button type="button" onClick={onStop} aria-label="Stop response" title="Stop response" className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background focus-visible:ring-2 focus-visible:ring-ring"><Square size={16} fill="currentColor" aria-hidden="true" /></button>
          : <button type="submit" disabled={busy || disabled || !value.trim()} aria-label="Send message" title="Send message" className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><ArrowUp size={20} aria-hidden="true" /></button>}
      </div>
    </form>
    {guidance && <div id={guidanceId} className="mt-2 px-2 text-xs leading-5 text-muted-foreground">{guidance}</div>}
  </div>;
}
