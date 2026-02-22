import { MyLibUserAuth } from "@/lib/user-auth";
import AiHomeClient from "./AiHomeClient";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const user = await MyLibUserAuth();
  return (
    <AiHomeClient
      isLoggedIn={!!user}
      userId={(user as any)?.id ?? null}
      userName={(user as any)?.name ?? null}
    />
  );
}
