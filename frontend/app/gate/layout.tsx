import { Suspense } from 'react';

export const metadata = {
  title: 'Access Gate — VeggaStare',
  description: 'Enter your access password to continue',
};

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
