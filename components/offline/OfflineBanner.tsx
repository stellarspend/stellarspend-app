"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, X } from "lucide-react";
import { useOffline } from "./OfflineProvider";

export default function OfflineBanner() {
  const { isOnline } = useOffline();
  const pathname = usePathname();
  const [dismissedPath, setDismissedPath] = useState<string | null>(null);
  const dismissed = dismissedPath === pathname;

  return (
    <AnimatePresence>
      {!isOnline && !dismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-50 w-full overflow-hidden bg-amber-500 px-4 py-2 text-white shadow-md"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 text-sm font-medium">
            <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="flex-1 text-center">
              You are currently offline. Some features may be unavailable, but your actions will be
              queued.
            </span>
            <button
              type="button"
              onClick={() => setDismissedPath(pathname)}
              className="rounded-full p-1 text-white/90 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
              aria-label="Dismiss offline banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
