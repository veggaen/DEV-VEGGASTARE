/** @fileOverview Restore nested route scroll, including anchors that arrive after Suspense. @stability stable */
export function restoreRouteScroll(scroller: HTMLElement, hash: string): () => void {
  let id = '';
  try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { /* Invalid fragments fall back to top. */ }
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const cancelEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    for (const event of cancelEvents) scroller.removeEventListener(event, stop);
  };
  const findAnchor = () => {
    if (stopped || !id) return false;
    const anchor = document.getElementById(id);
    if (!anchor || !scroller.contains(anchor)) return false;
    anchor.scrollIntoView({ block: 'start', behavior: 'instant' });
    stop();
    return true;
  };
  if (findAnchor()) return stop;
  scroller.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (!id) return stop;

  // App Router can mount the destination after the shell's layout effect.
  // Observe only until that target arrives; never pull a user back after input.
  observer = new MutationObserver(findAnchor);
  observer.observe(scroller, { childList: true, subtree: true });
  for (const event of cancelEvents) scroller.addEventListener(event, stop, { passive: true });
  timer = setTimeout(stop, 15_000);
  return stop;
}
