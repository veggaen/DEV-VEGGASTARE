"use client";

import { Suspense } from "react";
import { MyAuthErrorCard } from "@/components/uicustom/auth/error-card";
import { useSearchParams } from "next/navigation";

// User-facing messages (not developer diagnostics). Kept friendly + actionable.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "We couldn't start sign-in with that provider. Please try again, or use a different method.",
  OAuthCallbackError: "Sign-in didn't complete. Please try again — if it keeps happening, try another provider.",
  Configuration: "This sign-in method is temporarily unavailable. Please try another option (Google, GitHub, or email) for now.",
  AccessDenied: "Sign-in was cancelled or access wasn't granted.",
  Verification: "This sign-in link is invalid or has expired. Please request a new one.",
};

function AuthErrorInner() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || undefined;
  const description = errorCode
    ? OAUTH_ERROR_MESSAGES[errorCode] || "Something went wrong during sign-in. Please try again."
    : undefined;

  return <MyAuthErrorCard description={description} />;
}

const MyAuthErrorPage = () => (
  <Suspense fallback={<MyAuthErrorCard description="Loading…" />}>
    <AuthErrorInner />
  </Suspense>
);

export default MyAuthErrorPage;
