'use client';

import { useState } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { AnimatePresence, motion } from 'framer-motion';
import { FiRefreshCw } from 'react-icons/fi';

/**
 * Slim banner that appears when a new deployment is detected.
 * Clicking it clears caches and hard-refreshes. While the refresh is in flight
 * the button shows an active "Updating…" state (spinning icon + animated
 * shimmer) so the click never feels static.
 */
export function UpdateBanner() {
  const { updateAvailable, refresh } = useVersionCheck();
  const [updating, setUpdating] = useState(false);

  const handleClick = () => {
    if (updating) return;
    setUpdating(true);
    void refresh();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <button
            type="button"
            onClick={handleClick}
            disabled={updating}
            className="group relative w-full overflow-hidden flex items-center justify-center gap-2 px-4 py-2 text-white text-xs font-medium bg-linear-to-r from-indigo-500 via-purple-600 to-indigo-500 bg-size-[200%_100%] animate-[shimmer_2.4s_linear_infinite] hover:brightness-110 transition-[filter] disabled:cursor-wait"
          >
            {/* Sheen sweep on hover/active */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out"
            />
            <FiRefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : 'animate-[spin_3s_linear_infinite]'}`} />
            <span className="relative">
              {updating ? 'Updating — reloading…' : 'A new version is available — click to update'}
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
