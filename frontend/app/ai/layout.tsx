import type { Metadata } from "next";
import { MyLibUserAuth } from "@/lib/user-auth";
import { AiChatShell } from "./AiChatShell";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "Group AI chat with BYOK support, multiple AI participants, and real-time collaboration.",
};

/**
 * Layout for /ai/* routes — the two-pane chat app shell. The conversation rail
 * (left) wraps the active thread (the page `children`, right), so /ai and
 * /ai/[id] share one cohesive interface. No auth gate here — anonymous users can
 * view shared public conversations; auth-gating is per-page/per-action.
 */
export default async function AiLayout({ children }: { children: React.ReactNode }) {
  const user = await MyLibUserAuth();
  return <AiChatShell isLoggedIn={!!user}>{children}</AiChatShell>;
}
