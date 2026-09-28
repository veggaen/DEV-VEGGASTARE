import { MyLibUserAuth } from '@/lib/user-auth';
import AiConversationClient from './[id]/AiConversationClient';
export const dynamic = 'force-dynamic';

export default async function AiPage() {
  const user = await MyLibUserAuth();
  return <AiConversationClient key={`new:${user?.id ?? 'guest'}`} sessionId="" isLoggedIn={!!user}
    userId={user?.id ?? null} userName={user?.name ?? null} userRole={user?.role ?? null} />;
}
