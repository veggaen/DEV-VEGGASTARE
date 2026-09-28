'use client';
import { memo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// No raw HTML, remote image auto-loading, or unsafe URL transforms.
export const MessageContent = memo(function MessageContent({ content }: { content: string }) {
  return <div className="min-w-0 text-base leading-7 [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
      p: ({ children }) => <p className="my-3 whitespace-pre-wrap">{children}</p>,
      h1: ({ children }) => <h2 className="mt-6 mb-3 text-xl font-semibold tracking-tight">{children}</h2>,
      h2: ({ children }) => <h3 className="mt-5 mb-2 text-lg font-semibold">{children}</h3>,
      h3: ({ children }) => <h4 className="mt-4 mb-2 font-semibold">{children}</h4>,
      ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
      ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground">{children}</a>,
      // Only our own authenticated media route renders inline (chat-generated
      // images); anything else stays a link so remote images never auto-load.
      img: ({ src, alt }) => typeof src === 'string' && /^\/api\/ai-media\/[a-zA-Z0-9_-]+\/content$/.test(src)
        // eslint-disable-next-line @next/next/no-img-element
        ? <a href={src} target="_blank" rel="noopener noreferrer" className="my-3 block max-w-md overflow-hidden rounded-xl border border-border/60 bg-foreground/[0.03]"><img src={src} alt={alt ?? 'Generated image'} width={1024} height={1024} className="h-auto w-full" loading="lazy" /></a>
        : <a href={typeof src === 'string' ? src : undefined} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{alt || 'Open image'}</a>,
      pre: ({ children }) => <pre tabIndex={0} aria-label="Code block" className="my-4 max-w-full overflow-x-auto rounded-xl border border-border bg-foreground/[0.06] p-4 text-sm leading-6 [overflow-wrap:normal] focus-visible:ring-2 focus-visible:ring-ring">{children}</pre>,
      code: ({ children, className }) => <code className={className ?? 'rounded bg-foreground/[0.07] px-1 py-0.5 text-[0.9em]'}>{children}</code>,
      blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary/50 pl-4 text-muted-foreground">{children}</blockquote>,
      table: ({ children }) => <div role="region" aria-label="Table" tabIndex={0} className="my-4 max-w-full overflow-x-auto rounded-xl border border-border"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
      th: ({ children }) => <th className="border-b border-border bg-foreground/[0.06] px-3 py-2 font-semibold">{children}</th>,
      td: ({ children }) => <td className="border-b border-border px-3 py-2">{children}</td>,
    }}>{content}</Markdown>
  </div>;
});
export function CopyMessage({ content }: { content: string }) {
  const [status, setStatus] = useState('Copy');
  return <button type="button" aria-label="Copy response" className="mt-2 min-h-11 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    onClick={async () => { try { await navigator.clipboard.writeText(content); setStatus('Copied'); } catch { setStatus('Select text to copy'); } }}><span aria-live="polite">{status}</span></button>;
}
