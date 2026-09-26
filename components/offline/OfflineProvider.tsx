"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  saveEncrypted,
  loadEncrypted,
  loadPlaintext,
  migrateToEncrypted,
  detectPlaintextData,
} from "../../lib/crypto/localEncryption";
import {
  applyConflictResolution,
  replayQueuedActions,
  type ConflictPrompt,
  type ConflictResolution,
} from "./actionHandlers";
import { createSyncAdapter } from "./syncAdapter";

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
  /**
   * Queued edits that another device changed at the same time. Each one needs
   * the user to choose which values to keep before it can be applied.
   */
  pendingConflicts: ConflictPrompt[];
  /** Applies the user's decision and removes the action from the queue. */
  resolveConflict: (
    actionId: string,
    resolution: ConflictResolution,
  ) => Promise<void>;
  /** Hides a conflict dialog without deciding; the action stays queued. */
  dismissConflict: (actionId: string) => void;
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
  // Edits that clash with another device, plus the ones the user has hidden for
  // now (the action stays in the queue until they decide).
  const [pendingConflicts, setPendingConflicts] = useState<ConflictPrompt[]>([]);
  const [dismissedConflictIds, setDismissedConflictIds] = useState<string[]>([]);
  const syncAdapter = useMemo(() => createSyncAdapter(), []);

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

  /**
   * Replays the queue with version checks. Applied actions leave the queue;
   * conflicting ones are surfaced for the user to decide.
   */
  const syncQueue = useCallback(async () => {
    if (queuedActions.length === 0) {
      return;
    }

    const outcome = await replayQueuedActions(queuedActions, syncAdapter);

    if (outcome.appliedIds.length > 0) {
      const applied = new Set(outcome.appliedIds);
      setQueuedActions((prev) => prev.filter((action) => !applied.has(action.id)));
    }

    if (outcome.conflictPrompts.length > 0) {
      setPendingConflicts((prev) => {
        const known = new Set(prev.map((conflict) => conflict.actionId));
        return [
          ...prev,
          ...outcome.conflictPrompts.filter(
            (conflict) => !known.has(conflict.actionId),
          ),
        ];
      });
    }
  }, [queuedActions, syncAdapter]);

  // Reconnect flow: replay whatever was queued while the device was offline.
  useEffect(() => {
    if (!isOnline || !hasLoaded) return;
    void syncQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, hasLoaded]);

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
    void syncQueue();
  }, [queuedActions, syncQueue]);

  const resolveConflict = useCallback(
    async (actionId: string, resolution: ConflictResolution) => {
      const conflict = pendingConflicts.find(
        (candidate) => candidate.actionId === actionId,
      );
      if (!conflict) {
        return;
      }

      await applyConflictResolution(conflict, resolution, syncAdapter, {
        updatedAt: new Date().toISOString(),
      });

      setPendingConflicts((prev) =>
        prev.filter((candidate) => candidate.actionId !== actionId),
      );
      setQueuedActions((prev) =>
        prev.filter((action) => action.id !== actionId),
      );
    },
    [pendingConflicts, syncAdapter],
  );

  const dismissConflict = useCallback((actionId: string) => {
    setDismissedConflictIds((prev) =>
      prev.includes(actionId) ? prev : [...prev, actionId],
    );
  }, []);

  const visibleConflicts = useMemo(
    () =>
      pendingConflicts.filter(
        (conflict) => !dismissedConflictIds.includes(conflict.actionId),
      ),
    [pendingConflicts, dismissedConflictIds],
  );

  const clearQueue = useCallback(() => {
    setQueuedActions([]);
    setPendingConflicts([]);
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
        pendingConflicts: visibleConflicts,
        resolveConflict,
        dismissConflict,
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
