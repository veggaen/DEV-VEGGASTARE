"use client";
/** @fileOverview One-click isolated demo sign-in, without shared credentials. @stability experimental */
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { demoLoginMessage } from '@/lib/demo-login-message';

import { useClientReady } from '@/hooks/use-client-ready';

export default function DemoLoginButton() {
  const ready = useClientReady();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="flex flex-col items-center gap-2">
    <Button type="button" variant="outline" className="min-h-11 px-6" disabled={!ready || pending}
      onClick={async () => {
        setPending(true); setError("");
        try {
          const result = await signIn("demo", { redirect: false, callbackUrl: "/products" });
          if (!result?.ok || result.error) {
            setError(demoLoginMessage(result?.code));
            setPending(false);
            return;
          }
          window.location.assign("/products");
        } catch { setError(demoLoginMessage()); setPending(false); }
      }}>{pending ? "Opening demo…" : "Try the demo — no payment"}</Button>
    {error && <div className="w-full max-w-sm rounded-lg border border-border bg-background/95 p-3 text-left">
      <p role="alert" className="text-sm text-foreground">{error}</p>
      <nav aria-label="Demo alternatives" className="mt-2 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11"><Link href="/products">Browse products</Link></Button>
        <Button asChild variant="ghost" className="min-h-11"><Link href="/auth/login">Sign in</Link></Button>
      </nav>
    </div>}
  </div>;
}
