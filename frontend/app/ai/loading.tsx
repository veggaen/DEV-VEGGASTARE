export default function AiLoading() {
  return <div role="status" aria-label="Loading chat" className="grid h-full place-items-center px-4">
    <div className="w-full max-w-3xl space-y-7"><div className="mx-auto h-8 w-52 rounded-lg bg-muted motion-safe:animate-pulse" /><div className="h-32 rounded-3xl border border-border bg-foreground/[0.05] motion-safe:animate-pulse" /></div>
  </div>;
}
