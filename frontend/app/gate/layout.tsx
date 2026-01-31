import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Access Gate — VeggaStare',
  description: 'VeggaStare is currently in private testing mode. Enter your access credentials to continue.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
