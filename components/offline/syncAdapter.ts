"use client";

import {
  fetchBudgets,
  fetchSharedBudgets,
  getConnectedPublicKey,
  proposeBudgetChange,
  updateBudget,
} from "@/lib/api/client";
import type { Budget, SharedBudget } from "@/lib/api/client";
import {
  fetchGoals,
  getMockGoalsFallback,
  updateGoalLocal,
} from "@/lib/stellar/savingsGoalContract";
import type { Goal } from "@/lib/types/savings";

import type {
  SyncAdapter,
  VersionedRecord,
  VersionedUpdateType,
} from "./actionHandlers";

/**
 * Concretely reads and writes the records the offline queue replays.
 *
 * Kept separate from `actionHandlers.ts` so the conflict logic stays free of
 * contract/wallet dependencies and can be unit tested in isolation.
 */

function writableFields(record: VersionedRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    ...(record as unknown as Record<string, unknown>),
  };
  delete fields.id;
  delete fields.updatedAt;
  delete fields.createdAt;
  return fields;
}

async function fetchRecords(
  type: VersionedUpdateType,
): Promise<VersionedRecord[]> {
  switch (type) {
    case "UPDATE_BUDGET":
      return fetchBudgets();

    case "UPDATE_GOAL": {
      const publicKey = getConnectedPublicKey();
      if (publicKey) {
        return fetchGoals(publicKey);
      }
      return getMockGoalsFallback();
    }

    case "UPDATE_SHARED_BUDGET":
      return fetchSharedBudgets();

    default:
      return [];
  }
}

async function applyRecord(
  type: VersionedUpdateType,
  record: VersionedRecord,
): Promise<void> {
  const fields = writableFields(record);

  switch (type) {
    case "UPDATE_BUDGET":
      await updateBudget(
        record.id,
        fields as Partial<Omit<Budget, "id" | "createdAt">>,
      );
      return;

    case "UPDATE_GOAL":
      updateGoalLocal(
        record.id,
        fields as Partial<
          Pick<Goal, "name" | "targetAmount" | "deadline" | "recurrence">
        >,
      );
      return;

    case "UPDATE_SHARED_BUDGET":
      // Co-owned budgets go through the approval flow, so replaying an offline
      // edit proposes the change for the other members instead of writing it.
      await proposeBudgetChange(
        record.id,
        fields as Partial<
          Pick<
            SharedBudget,
            "name" | "amount" | "category" | "asset" | "startDate" | "endDate"
          >
        >,
        "Offline edit synced after reconnecting",
      );
      return;

    default:
      throw new Error(`Applying ${type} is not supported yet.`);
  }
}

/** Builds the adapter used by the offline provider to replay queued updates. */
export function createSyncAdapter(): SyncAdapter {
  return {
    supports(type) {
      // Split bills are not persisted yet (see lib/types/splits.ts), so their
      // queued actions stay in the queue rather than being reported as failed.
      return type !== "UPDATE_SPLIT_BILL";
    },
    fetchCurrent(type, id) {
      return fetchRecords(type).then(
        (records) => records.find((record) => record.id === id) ?? null,
      );
    },
    apply(type, record) {
      return applyRecord(type, record);
    },
  };
}
