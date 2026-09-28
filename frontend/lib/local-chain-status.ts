/** @fileOverview Bounded, cancellable local development-chain probes. @stability experimental */
export async function readLocalChainStatus(chainId: number, rpcUrl: string, signal: AbortSignal): Promise<'online' | 'offline'> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 2000);
  try {
    if (signal.aborted) return 'offline';
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
      signal: controller.signal,
    });
    if (!response.ok) return 'offline';
    const { result } = await response.json();
    return typeof result === 'string' && /^0x[0-9a-f]+$/i.test(result) && BigInt(result) === BigInt(chainId) ? 'online' : 'offline';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
