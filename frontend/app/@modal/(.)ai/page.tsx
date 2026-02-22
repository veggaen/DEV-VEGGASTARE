"use client";

import AiModalShell from "../AiModalShell";
import AiHomeClient from "@/app/ai/AiHomeClient";
import { useSession } from "next-auth/react";

export default function AiModalHomePage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <AiModalShell>
      <AiHomeClient
        isLoggedIn={!!user}
        userId={user?.id ?? null}
        userName={user?.name ?? null}
      />
    </AiModalShell>
  );
}
