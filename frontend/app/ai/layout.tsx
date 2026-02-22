import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "Group AI chat with BYOK support, multiple AI participants, and real-time collaboration.",
};

/**
 * Layout for /ai/* routes.
 * No auth gate — anonymous users can view shared public conversations.
 * Auth-gating happens per-page/per-action where needed.
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
