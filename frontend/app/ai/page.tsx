import { MyLibUserAuth } from "@/lib/user-auth";
import AiHomeClient from "./AiHomeClient";
import { AiEmptyState } from "./AiEmptyState";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const user = await MyLibUserAuth();
  const isLoggedIn = !!user;

  // Logged-in: the conversation list lives in the shell rail (AiChatShell), so /ai
  // is just the right-pane empty state. Logged-out: show the anonymous hero with
  // sign-in CTAs and starter prompts.
  if (isLoggedIn) {
    return <AiEmptyState userName={(user as { name?: string })?.name ?? null} />;
  }
  return <AiHomeClient isLoggedIn={false} userId={null} userName={null} />;
}
