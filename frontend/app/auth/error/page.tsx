"use client";

import { Suspense } from "react";
import { MyAuthErrorCard } from "@/components/uicustom/auth/error-card";
import { useSearchParams } from "next/navigation";
import { authErrorMessage } from "@/lib/auth-errors";

function AuthErrorInner() {
  const searchParams = useSearchParams();
  const description = authErrorMessage(searchParams.get("error"));

  return <MyAuthErrorCard description={description} />;
}

const MyAuthErrorPage = () => (
  <Suspense fallback={<MyAuthErrorCard description="Loading…" />}>
    <AuthErrorInner />
  </Suspense>
);

export default MyAuthErrorPage;
