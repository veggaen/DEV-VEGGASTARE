/** @fileOverview Authenticated server fetch of a private asset; never return its storage token. @stability experimental */
import 'server-only';
import { initEdgeStore } from '@edgestore/server';
import { initEdgeStoreSdk } from '@edgestore/server/core';

const es = initEdgeStore.context<{ userId: string; role: string }>().create();
const router = es.router({ digitalAssets: es.fileBucket()
  .path(({ ctx }) => [{ owner: ctx.userId }])
  .accessControl({ OR: [{ userId: { path: 'owner' } }, { role: { eq: 'ADMIN' } }] }),
});

export function privateStorageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'files.edgestore.dev' || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('Invalid private storage location');
  }
  return url.toString();
}

/** Caller must authenticate the buyer and validate their paid/demo entitlement first. */
export async function fetchPrivateDownload(storageKey: string, uploadedById: string) {
  const url = privateStorageUrl(storageKey);
  const token = await initEdgeStoreSdk({}).getToken({ router, ctx: { userId: uploadedById, role: 'USER' } });
  return fetch(url, { headers: { Cookie: `edgestore-token=${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
}
