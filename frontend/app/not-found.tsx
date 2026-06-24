import Link from 'next/link';
import { FiCompass, FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      {/* Big, quiet 404 watermark behind the icon — gives the page a confident
          focal point instead of a lone heading. */}
      <div className="relative mb-7 grid place-items-center">
        <span
          aria-hidden
          className="pointer-events-none select-none text-[7rem] font-black leading-none tracking-tighter text-foreground/[0.04] sm:text-[9rem]"
        >
          404
        </span>
        <div className="absolute grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 ring-1 ring-border/60">
          <FiCompass className="h-7 w-7 text-muted-foreground/70" />
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        This page wandered off
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        The page you’re looking for doesn’t exist or may have moved. Let’s get you
        back on track.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-[gap] duration-200 hover:gap-3"
        >
          <FiArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Go home
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
