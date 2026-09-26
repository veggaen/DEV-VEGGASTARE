import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { visibleImageWhere } from '@/lib/ai-chat/images';
import { readChatImage } from '@/lib/ai-chat/image-storage';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
  try {
    const user = await MyLibUserAuth();
    if (!user?.id) return new Response(null, { status: 401, headers });
    const { id } = await params;
    const row = await dbPrisma.aiChatImage.findFirst({ where: { id, ...visibleImageWhere(user.id) }, select: { ownerId: true, storageKey: true } });
    if (!row?.storageKey) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(await readChatImage(row.storageKey, row.ownerId)), { headers: { ...headers, 'Content-Type': 'image/jpeg', 'Content-Disposition': 'inline; filename="chat-image.jpg"' } });
  } catch { return new Response(null, { status: 503, headers }); }
}
