'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiDownload, FiImage, FiVideo, FiRefreshCw } from 'react-icons/fi';
import { MEDIA_MODELS, type MediaKind } from '@/lib/ai-media/policy';
import { cn } from '@/lib/utils';

type Job = { id: string; kind: MediaKind; state: string; prompt: string; credits: number; createdAt: string; errorCode: string | null; contentUrl: string | null };
type Workspace = { jobs: Job[]; balance: number; isDemo: boolean; options: { kind: MediaKind; label: string; credits: number; detail: string; available: boolean }[] };
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50';
const pending = (job?: Job | null) => Boolean(job && ['CREATING','PROCESSING'].includes(job.state));
const failureCopy: Record<string,string> = {
  MEDIA_PROVIDER_ACCESS: 'The provider needs access verification. Your credits were returned.',
  MEDIA_PROVIDER_LIMIT: 'The provider is at its limit. Your credits were returned.',
  MEDIA_REQUEST_REJECTED: 'The provider could not accept this prompt. Try a different description. Your credits were returned.',
  MEDIA_TIMED_OUT: 'Generation timed out. Your credits were returned.',
  MEDIA_COST_REVIEW: 'This model needs a pricing review. Your credits were returned.',
};
export function MediaStudio() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [kind, setKind] = useState<MediaKind>('IMAGE');
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const nonce = useRef<{ id: string; prompt: string; kind: MediaKind } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const fetchBusy = useRef(false);
  const refresh = useCallback(async () => {
    if (fetchBusy.current) return;
    fetchBusy.current = true;
    try {
      const response = await fetch('/api/ai-media', { cache: 'no-store', signal: AbortSignal.timeout(100_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Could not load your generations.');
      setWorkspace(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not connect. Retry below.'); }
    finally { fetchBusy.current = false; setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const hasPending = workspace?.jobs.some(pending) ?? false;
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15_000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [hasPending, refresh]);
  const option = workspace?.options.find(value => value.kind === kind);
  const quote = MEDIA_MODELS[kind];
  const job = workspace?.jobs.find(value => value.id === selected) ?? workspace?.jobs[0];
  const insufficient = workspace !== null && workspace.balance < quote.credits;
  useEffect(() => {
    if (selected && window.matchMedia('(max-width: 1279px)').matches) resultRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [selected]);

  async function generate(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    const text = prompt.trim();
    if (text.length < 3 || new TextEncoder().encode(text).length > 1000) { setError('Describe your idea in 3–1,000 bytes.'); promptRef.current?.focus(); return; }
    if (!nonce.current || nonce.current.prompt !== text || nonce.current.kind !== kind) nonce.current = { id: crypto.randomUUID(), prompt: text, kind };
    setBusy(true);
    try {
      const response = await fetch('/api/ai-media', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: nonce.current.id, kind, prompt: text }), signal: AbortSignal.timeout(45_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Generation could not start.');
      setSelected(data.job.id);
      setWorkspace(previous => previous ? { ...previous, jobs: [data.job, ...previous.jobs.filter(value => value.id !== data.job.id)],
        balance: response.status === 202 ? Math.max(0, previous.balance - quote.credits) : previous.balance } : previous);
      nonce.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connection interrupted. Refresh history before trying again.'); }
    finally { setBusy(false); }
  }

  return <div className="h-full min-w-0 overflow-y-auto overscroll-contain" data-media-studio>
    <div className="mx-auto max-w-[1280px] px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/ai" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline"><FiArrowLeft aria-hidden="true" /> AI chat</Link><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create something.</h1></div>
        <Link href="/ai/credits" className={button}><span className="tabular-nums">{workspace ? new Intl.NumberFormat().format(workspace.balance) : '—'}</span> credits</Link>
      </header>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:gap-7">
        <form onSubmit={generate} className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Create media">
          <fieldset><legend className="sr-only">Output type</legend><div className="grid grid-cols-2 gap-2">{(['IMAGE','VIDEO'] as const).map(value => <label key={value} className={cn(button, 'cursor-pointer', kind === value && 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light')}>
            <input type="radio" name="media-kind" value={value} checked={kind === value} disabled={busy} onChange={() => setKind(value)} className="accent-brand-accent" />
            {value === 'IMAGE' ? <FiImage aria-hidden="true" /> : <FiVideo aria-hidden="true" />}{value === 'IMAGE' ? 'Image' : 'Video'}</label>)}</div></fieldset>
          <div><label htmlFor="media-prompt" className="mb-2 block text-sm font-medium">Your idea</label><textarea ref={promptRef} id="media-prompt" name="prompt" autoComplete="off" value={prompt} disabled={busy} maxLength={1000} onChange={event => setPrompt(event.target.value)}
            placeholder={kind === 'IMAGE' ? 'A misty fjord, soft morning light, editorial illustration…' : 'A paper boat drifting across a quiet lake, slow camera pan…'}
            className="min-h-36 w-full resize-y rounded-xl border border-border bg-background p-3 text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" aria-describedby="media-spec" /></div>
          <div id="media-spec" className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{quote.label}</span><span className="text-muted-foreground">{quote.detail}</span></div>
          <div className="border-t border-border pt-4"><div className="mb-4 flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Per generation</span><strong className="text-xl tabular-nums">{quote.credits} credits</strong></div>
            {workspace?.isDemo ? <p className="text-sm text-muted-foreground">Explore Studio here. <Link href="/auth/register" className="underline">Create your own account</Link> to generate media.</p> : insufficient ? <Link href="/products/cveggatinterviewcredits01" className={cn(button, 'w-full')}>Buy credits</Link> :
            <button type="submit" disabled={busy || loading || !option?.available || hasPending} className={cn(button, 'w-full border-transparent bg-brand-accent text-foreground hover:bg-brand-accent-light')}>{busy ? 'Starting…' : hasPending ? 'Generation in progress…' : !option?.available && !loading ? 'Temporarily unavailable' : `Generate ${kind === 'IMAGE' ? 'image' : 'video'}`}</button>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Private to your account. Credits return if generation fails.</p>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-2 focus-visible:outline">Usage & privacy</summary><p className="pt-2 leading-relaxed">Your prompt is sent to {kind === 'IMAGE' ? 'OpenAI' : 'xAI'}. Avoid private information. Provider safety rules apply. Results are AI-generated and may be inaccurate; review before publishing. Studio uses Veggat credits, not saved personal API keys.</p></details>
        </form>
        <section ref={resultRef} aria-label="Generation result" aria-live="polite" className="flex min-w-0 scroll-mt-4 flex-col rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
          {job?.state === 'COMPLETED' && job.contentUrl ? <>
            <div className="flex min-h-60 flex-1 items-center justify-center overflow-hidden rounded-xl bg-background">
              {job.kind === 'IMAGE' ? /* Authenticated file: do not send to Next's public image optimizer. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={job.contentUrl} alt={job.prompt} width={1024} height={1024} className="max-h-[min(52dvh,480px)] w-full object-contain" /> :
                <video src={job.contentUrl} controls playsInline preload="metadata" aria-label={job.prompt} className="max-h-[min(52dvh,480px)] w-full"><track kind="captions" />Your browser does not support this video. Use Download below.</video>}
            </div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">AI-generated · {job.credits} credits</p><a href={`${job.contentUrl}?download=1`} download={`veggat-${job.id}.${job.kind === 'IMAGE' ? 'png' : 'mp4'}`} className={button}><FiDownload aria-hidden="true" /> Download {job.kind === 'IMAGE' ? 'PNG' : 'MP4'}</a></div>
          </> : <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 p-4 text-center sm:min-h-80">
            {pending(job) ? <><span aria-hidden="true" className="size-8 rounded-full border-2 border-brand-accent border-t-transparent motion-safe:animate-spin" /><h2 className="text-lg font-medium">{job?.kind === 'VIDEO' ? 'Rendering your clip…' : 'Creating your image…'}</h2><p className="max-w-xs text-sm text-muted-foreground">You can leave this page. Find the result in your history.</p></> : job?.state === 'FAILED' ? <><h2 className="text-lg font-medium">Couldn’t finish this generation</h2><p className="max-w-xs text-sm text-muted-foreground">{failureCopy[job.errorCode ?? ''] ?? 'Your credits were returned. Try a different prompt or retry later.'}</p></> : <><FiImage aria-hidden="true" className="size-9 text-brand-accent/70" /><h2 className="text-lg font-medium">A blank canvas. Your idea.</h2><p className="max-w-xs text-sm text-muted-foreground">Start with an image or a short video.</p></>}
          </div>}
        </section>
      </div>
      {error && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 p-4 text-sm"><p className="min-w-0 flex-1 break-words">{error}</p><button type="button" onClick={() => { setError(null); void refresh(); }} className={button}>Refresh history</button></div>}
      <section className="mt-8" aria-label="Generation history"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your creations</h2><button type="button" onClick={() => void refresh()} className={button} aria-label="Refresh generations"><FiRefreshCw aria-hidden="true" /></button></div>
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading creations…</p> : !workspace?.jobs.length ? <p className="text-sm text-muted-foreground">Your images and clips will appear here.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workspace.jobs.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)} aria-pressed={item.id === job?.id} className={cn('min-w-0 rounded-xl border border-border p-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring', item.id === job?.id && 'border-brand-accent/50 bg-brand-accent/5')}><span className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">{item.kind === 'IMAGE' ? <FiImage aria-hidden="true" /> : <FiVideo aria-hidden="true" />}{item.state === 'COMPLETED' ? 'Ready' : item.state === 'FAILED' ? 'Credits returned' : 'Generating…'} · {item.credits} credits</span><span className="line-clamp-2 break-words text-sm">{item.prompt}</span></button>)}</div>}
      </section>
    </div>
  </div>;
}
