'use client';
/** @fileOverview Shared authenticated download transfer with bounded waits and recoverable errors. @stability stable */
import { useEffect, useRef, useState } from 'react';

export function usePrivateDownload(onSettled?: () => void) {
  const [transfer, setTransfer] = useState<{ id: string; message: string; failed?: boolean } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function download(file: { id: string; token: string; fileName: string }) {
    if (lock.current) return;
    lock.current = true; setPending(file.id); setTransfer(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch('/api/download/' + encodeURIComponent(file.token), {
        cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]),
      });
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Please sign in again before downloading.'
          : response.status === 410 ? 'This download has expired or is no longer available.'
          : response.status === 403 ? 'This account cannot download this file.'
          : response.status === 429 ? 'Download limit reached. Check your remaining uses or try again later.'
          : 'The file could not be downloaded. Please try again.');
      }
      const blob = await response.blob();
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = file.fileName;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setTransfer({ id: file.id, message: 'File sent to your browser. Check your downloads.' });
    } catch (failure) {
      if (!abort.signal.aborted) setTransfer({ id: file.id, failed: true,
        message: failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message
          : 'The download timed out. Check your downloads before trying again.' });
    } finally {
      lock.current = false; controller.current = null;
      if (!abort.signal.aborted) { setPending(null); onSettled?.(); }
    }
  }
  return { pending, transfer, download };
}
