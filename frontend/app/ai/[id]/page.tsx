import { MyLibUserAuth } from "@/lib/user-auth";
import AiConversationClient from "./AiConversationClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AiConversationPage({ params }: Props) {
  const { id } = await params;
  const user = await MyLibUserAuth();

  return (
    <AiConversationClient
      sessionId={id}
      isLoggedIn={!!user}
      userId={(user as any)?.id ?? null}
      userName={(user as any)?.name ?? null}
      userRole={(user as any)?.role ?? null}
    />
  );
}
