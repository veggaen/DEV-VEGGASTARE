import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Private preview — Veggat',
  description: 'Veggat is in private preview. Enter the access password to continue.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-8 rounded-full border-4 border-border border-t-brand-accent motion-safe:animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
