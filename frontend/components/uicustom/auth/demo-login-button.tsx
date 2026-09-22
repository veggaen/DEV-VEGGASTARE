"use client";
/** @fileOverview One-click isolated demo sign-in, without shared credentials. @stability experimental */
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function DemoLoginButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="flex flex-col items-center gap-2">
    <Button type="button" variant="outline" className="min-h-11 px-6" disabled={pending}
      onClick={async () => {
        setPending(true); setError("");
        try {
          const result = await signIn("demo", { redirect: false, callbackUrl: "/products" });
          if (!result?.ok || result.error) throw new Error("Demo is busy. Please try again later or create an account.");
          window.location.assign("/products");
        } catch (e) { setError(e instanceof Error ? e.message : "Could not open the demo."); setPending(false); }
      }}>{pending ? "Opening demo…" : "Try the demo — no payment"}</Button>
    {error && <p role="alert" className="max-w-sm text-sm text-destructive">{error}</p>}
  </div>;
}
