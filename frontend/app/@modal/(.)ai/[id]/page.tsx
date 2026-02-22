"use client";

import { use } from "react";
import { useSession } from "next-auth/react";
import AiModalShell from "../../AiModalShell";
import AiConversationClient from "@/app/ai/[id]/AiConversationClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default function AiModalConversationPage({ params }: Props) {
  const { id } = use(params);
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <AiModalShell>
      <AiConversationClient
        sessionId={id}
        isLoggedIn={!!user}
        userId={user?.id ?? null}
        userName={user?.name ?? null}
        userRole={user?.role ?? null}
      />
    </AiModalShell>
  );
}
