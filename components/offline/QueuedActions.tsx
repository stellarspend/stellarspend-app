"use client";

import { useState } from "react";
import { Clock, RefreshCw, Trash2 } from "lucide-react";
import { QueuedAction, useOffline } from "./OfflineProvider";

/**
 * QueuedActions displays a collapsible panel of actions that were queued
 * while the user was offline. It shows the count of pending actions and
 * provides buttons to retry syncing or clear the queue entirely.
 */
export default function QueuedActions() {
  const { queuedActions, retryQueuedActions, clearQueue } = useOffline();
  const [isOpen, setIsOpen] = useState(false);

  const queuedActionCount = queuedActions.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2"
        >
          <Clock className="h-4 w-4 text-[#e8b84b]" />

          <span className="text-sm font-semibold text-white">
            Queued Actions
          </span>

          {queuedActionCount > 0 && (
            <span
              aria-label={`${queuedActionCount} queued action${
                queuedActionCount === 1 ? "" : "s"
              }`}
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#e8b84b] px-2 py-0.5 text-xs font-bold text-black"
            >
              {queuedActionCount}
            </span>
          )}
        </button>

        {queuedActionCount > 0 && (
          <div className="flex gap-2">
            <button
              onClick={retryQueuedActions}
              className="rounded-lg p-2 hover:bg-white/5"
              aria-label="Retry queued actions"
            >
              <RefreshCw className="h-4 w-4 text-white" />
            </button>

            <button
              onClick={clearQueue}
              className="rounded-lg p-2 hover:bg-white/5"
              aria-label="Clear queue"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* Queue Panel */}
      {isOpen && (
        <div className="mt-4 space-y-2">
          {queuedActionCount === 0 ? (
            <p className="text-sm text-gray-400">
              No queued actions.
            </p>
          ) : (
            queuedActions.map((action: QueuedAction) => (
              <div
                key={action.id}
                className="rounded-lg border border-white/10 p-3"
              >
                <div className="text-sm font-medium text-white">
                  {action.type}
                </div>

                <div className="text-xs text-gray-400">
                  Pending sync
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}