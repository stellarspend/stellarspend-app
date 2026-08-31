"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  saveEncrypted,
  loadEncrypted,
  loadPlaintext,
  migrateToEncrypted,
  detectPlaintextData,
} from "../../lib/crypto/localEncryption";

/**
 * Represents a pending action that was queued while offline.
 */
export interface QueuedAction {
  id: string;
  type: string;
  description: string;
  data: unknown;
  timestamp: number;
}

interface OfflineContextType {
  isOnline: boolean;
  queuedActions: QueuedAction[];
  queueAction: (type: string, description: string, data: unknown) => void;
  removeAction: (id: string) => void;
  retryQueuedActions: () => void;
  clearQueue: () => void;
  isUnlocked: boolean;
  unlockQueue: (passphrase: string) => Promise<boolean>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);
const QUEUE_STORAGE_KEY = "stellarspend_offline_queue";

// Shared passphrase reference - set by WalletContext
let sharedPassphrase: string | null = null;

export function setQueuePassphrase(passphrase: string) {
  sharedPassphrase = passphrase;
}

export function clearQueuePassphrase() {
  sharedPassphrase = null;
}

async function loadQueueData(passphrase?: string): Promise<QueuedAction[]> {
  if (typeof window === "undefined") {
    return [];
  }

  // First, check if there's plaintext data that needs migration
  const hasPlaintext = detectPlaintextData(QUEUE_STORAGE_KEY);

  if (hasPlaintext && passphrase) {
    const plaintextData = loadPlaintext<QueuedAction[]>(QUEUE_STORAGE_KEY);
    if (plaintextData) {
      await migrateToEncrypted(QUEUE_STORAGE_KEY, passphrase, plaintextData);
      return plaintextData;
    }
  }

  // Try to load encrypted data
  if (passphrase) {
    const encrypted = await loadEncrypted<QueuedAction[]>(QUEUE_STORAGE_KEY, passphrase);
    if (encrypted) {
      return encrypted;
    }
  }

  // Fallback to plaintext
  const plaintext = loadPlaintext<QueuedAction[]>(QUEUE_STORAGE_KEY);
  return plaintext || [];
}

async function saveQueueData(data: QueuedAction[], passphrase?: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (passphrase) {
    await saveEncrypted(QUEUE_STORAGE_KEY, data, passphrase);
    // Clear plaintext
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } else {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(data));
  }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(
    () => (typeof navigator !== "undefined" ? navigator.onLine : true),
  );
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  // Whether the initial load from storage has finished. Prevents the mount-time
  // `saveQueue` effect from clobbering already-persisted data with an empty
  // array before the async load completes (a race that could wipe the queue).
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadQueue = useCallback(async () => {
    const data = await loadQueueData(sharedPassphrase || undefined);
    setQueuedActions(data);
    if (sharedPassphrase) {
      setIsUnlocked(true);
    }
    setHasLoaded(true);
  }, []);

  // Fixed: Wrap loadQueue in an async init function
  useEffect(() => {
    const init = async () => {
      await loadQueue();
    };
    init();
  }, [loadQueue]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    const saveQueue = async () => {
      if (queuedActions.length > 0 || localStorage.getItem(QUEUE_STORAGE_KEY)) {
        await saveQueueData(queuedActions, sharedPassphrase || undefined);
      }
    };
    saveQueue();
  }, [queuedActions, hasLoaded]);

  const unlockQueue = useCallback(async (passphrase: string): Promise<boolean> => {
    try {
      sharedPassphrase = passphrase;
      await loadQueue();
      return true;
    } catch {
      return false;
    }
  }, [loadQueue]);

  const queueAction = useCallback((type: string, description: string, data: unknown) => {
    const newAction: QueuedAction = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      description,
      data,
      timestamp: Date.now(),
    };
    setQueuedActions((prev) => [...prev, newAction]);
  }, []);

  const removeAction = useCallback((id: string) => {
    setQueuedActions((prev) => prev.filter((action) => action.id !== id));
  }, []);

  const retryQueuedActions = useCallback(() => {
    if (queuedActions.length === 0) {
      return;
    }
    setQueuedActions((prev) => [...prev]);
  }, [queuedActions]);

  const clearQueue = useCallback(() => {
    setQueuedActions([]);
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        queuedActions,
        queueAction,
        removeAction,
        retryQueuedActions,
        clearQueue,
        isUnlocked,
        unlockQueue,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}

