import 'server-only';
import { initEdgeStore } from '@edgestore/server';
import { initEdgeStoreClient } from '@edgestore/server/core';
import { privateStorageUrl } from '@/lib/private-download-storage';
import { MEDIA_MAX_BYTES, MEDIA_MODELS, type MediaKind } from './policy';
const es = initEdgeStore.context<{ userId: string; role: string }>().create();
const router = es.router({ digitalAssets: es.fileBucket({ maxSize: MEDIA_MAX_BYTES })
  .path(({ ctx }) => [{ owner: ctx.userId }])
  .accessControl({ OR: [{ userId: { path: 'owner' } }, { role: { eq: 'ADMIN' } }] }),
});
export async function storeGeneratedMedia(userId: string, kind: MediaKind, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MEDIA_MAX_BYTES) throw new Error('MEDIA_INVALID_FILE');
  const format = MEDIA_MODELS[kind];
  const result = await initEdgeStoreClient({ router }).digitalAssets.upload({
    content: { blob: new Blob([new Uint8Array(bytes)], { type: format.mime }), extension: format.extension },
    ctx: { userId, role: 'USER' },
  });
  const url = privateStorageUrl(result.url);
  const raw = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  await raw.body?.cancel();
  if (![401,403].includes(raw.status)) throw new Error('MEDIA_STORAGE_NOT_PRIVATE');
  return url;
}
