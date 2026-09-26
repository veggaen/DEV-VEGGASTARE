import 'server-only';
import { initEdgeStore } from '@edgestore/server';
import { initEdgeStoreClient } from '@edgestore/server/core';
import { privateStorageUrl, fetchPrivateDownload } from '@/lib/private-download-storage';
import { readAiBytes } from './request';
import { CHAT_IMAGE_STORED_BYTES } from './image-policy';

const es = initEdgeStore.context<{ userId: string; role: string }>().create();
const router = es.router({ digitalAssets: es.fileBucket()
  .path(({ ctx }) => [{ owner: ctx.userId }])
  .accessControl({ OR: [{ userId: { path: 'owner' } }, { role: { eq: 'ADMIN' } }] }),
});
const client = () => initEdgeStoreClient({ router }).digitalAssets;
export async function storeChatImage(userId: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > CHAT_IMAGE_STORED_BYTES) throw new Error('IMAGE_SIZE');
  const uploaded = await client().upload({ content: { blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), extension: 'jpg' }, ctx: { userId, role: 'USER' } });
  const url = privateStorageUrl(uploaded.url);
  try {
    const raw = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    await raw.body?.cancel();
    if (![401, 403].includes(raw.status)) throw new Error('IMAGE_STORAGE_NOT_PRIVATE');
    return url;
  } catch (error) { await deleteChatImage(url).catch(() => undefined); throw error; }
}
export async function deleteChatImage(url: string) { await client().deleteFile({ url: privateStorageUrl(url) }); }
export async function readChatImage(url: string, ownerId: string) {
  const response = await fetchPrivateDownload(url, ownerId);
  if (!response.ok) { await response.body?.cancel(); throw new Error('IMAGE_UNAVAILABLE'); }
  // Reuse the bounded reader; no URL, storage token or original EXIF is exposed.
  return new Uint8Array(await readAiBytes(new Request('https://internal.invalid', { method: 'POST', body: response.body, duplex: 'half' } as RequestInit), CHAT_IMAGE_STORED_BYTES));
}
