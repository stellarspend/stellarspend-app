'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useOffline } from './OfflineProvider';
import { WifiOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
    const { isOnline } = useOffline();
    const pathname = usePathname();
    const [dismissed, setDismissed] = useState(false);

    // Banner lives in the root layout, so reset the dismissal when the route or
    // connectivity changes (compared during render) and it reappears on the next
    // page while still offline.
    const resetKey = `${pathname}:${isOnline}`;
    const [lastResetKey, setLastResetKey] = useState(resetKey);
    if (resetKey !== lastResetKey) {
        setLastResetKey(resetKey);
        setDismissed(false);
    }

    return (
        <AnimatePresence>
            {!isOnline && !dismissed && (
                <motion.div
                    role="alert"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="sticky top-0 z-50 w-full bg-amber-500 text-white py-2 px-4 shadow-md overflow-hidden"
                >
                    <div className="relative max-w-7xl mx-auto flex items-center justify-center space-x3 px-8 text-sm font-medium">
                        <WifiOff className="w-4 h-4 animate-pulse" />
                        <span>You are currently offline. Some features may be unavailable, but your actions will be queued.</span>
                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            aria-label="Dismiss offline notification"
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
