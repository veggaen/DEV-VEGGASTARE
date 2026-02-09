'use client';

import { useVersionCheck } from '@/hooks/useVersionCheck';
import { AnimatePresence, motion } from 'framer-motion';
import { FiRefreshCw } from 'react-icons/fi';

/**
 * Slim banner that appears when a new deployment is detected.
 * Clicking it hard-refreshes the page.
 */
export function UpdateBanner() {
  const { updateAvailable, refresh } = useVersionCheck();

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
            onClick={refresh}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium hover:from-indigo-600 hover:to-purple-700 transition-all"
          >
            <FiRefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
            A new version is available — click to update
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
