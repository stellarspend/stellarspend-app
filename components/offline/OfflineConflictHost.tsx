"use client";

import ConflictResolutionModal from "./ConflictResolutionModal";
import { useOffline } from "./OfflineProvider";

/**
 * Asks the user to settle one conflicting offline edit at a time.
 *
 * Mounted once by `ClientLayout`, next to the offline banner and queue panel, so
 * a conflict raised while reconnecting is visible from anywhere in the app.
 */
export default function OfflineConflictHost() {
  const { pendingConflicts, resolveConflict, dismissConflict } = useOffline();
  const conflict = pendingConflicts[0];

  if (!conflict) {
    return null;
  }

  return (
    <ConflictResolutionModal
      conflict={conflict}
      onResolve={(resolution) => {
        void resolveConflict(conflict.actionId, resolution);
      }}
      onDecideLater={() => dismissConflict(conflict.actionId)}
    />
  );
}
