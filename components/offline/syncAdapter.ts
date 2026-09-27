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
import { fetchSplitsForUser, updateSplitLocal } from "@/lib/stellar/escrowContract";
import type { Goal } from "@/lib/types/savings";
import type { SplitBill } from "@/lib/types/splits";

import {
  isVersionedUpdateType,
  type SyncAdapter,
  type VersionedRecord,
} from "./actionHandlers";

/**
 * Concrete read/write wiring for the offline conflict detector.
 *
 * `actionHandlers.ts` knows the merge rules but nothing about contracts or
 * wallets; this adapter is the other half. It registers every record type the
 * offline queue can replay — plain budgets/goals, and the multi-actor shared
 * budget (#11) and split bill (#10) records — so all of them run through the
 * exact same detection code.
 */

/** Strips the fields that are never part of an update from a merged record. */
function writableFields(record: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...record };
  delete fields.id;
  delete fields.updatedAt;
  delete fields.createdAt;
  return fields;
}

async function loadRecords(type: string): Promise<VersionedRecord[]> {
  switch (type) {
    case "UPDATE_BUDGET":
      return fetchBudgets();

    case "UPDATE_GOAL": {
      const publicKey = getConnectedPublicKey();
      return publicKey ? fetchGoals(publicKey) : getMockGoalsFallback();
    }

    case "UPDATE_SHARED_BUDGET":
      return fetchSharedBudgets();

    case "UPDATE_SPLIT_BILL": {
      const publicKey = getConnectedPublicKey();
      return publicKey ? fetchSplitsForUser(publicKey) : [];
    }

    default:
      return [];
  }
}

async function saveRecord(
  type: string,
  record: Record<string, unknown>,
): Promise<void> {
  const id = String(record.id);
  const fields = writableFields(record);

  switch (type) {
    case "UPDATE_BUDGET":
      await updateBudget(id, fields as Partial<Omit<Budget, "id" | "createdAt">>);
      return;

    case "UPDATE_GOAL": {
      const updated = updateGoalLocal(
        id,
        fields as Partial<Pick<Goal, "name" | "targetAmount" | "deadline" | "recurrence">>,
      );
      if (!updated) throw new Error(`Savings goal ${id} no longer exists.`);
      return;
    }

    case "UPDATE_SHARED_BUDGET":
      // Co-owned budgets can't be written directly: the offline edit is
      // proposed for the other members to approve, keeping the approval flow.
      await proposeBudgetChange(
        id,
        fields as Partial<
          Pick<
            SharedBudget,
            "name" | "amount" | "category" | "asset" | "startDate" | "endDate"
          >
        >,
        "Offline edit synced after reconnecting",
      );
      return;

    case "UPDATE_SPLIT_BILL": {
      const updated = updateSplitLocal(id, fields as Partial<SplitBill>);
      if (!updated) throw new Error(`Split bill ${id} no longer exists.`);
      return;
    }

    default:
      throw new Error(`Applying ${type} is not supported.`);
  }
}

/** Builds the adapter used by the offline provider to replay queued updates. */
export function createSyncAdapter(): SyncAdapter {
  return {
    supports(type) {
      return isVersionedUpdateType(type);
    },

    async loadCurrent(type, id) {
      const records = await loadRecords(type);
      return records.find((record) => record.id === id) ?? null;
    },

    save(type, record) {
      return saveRecord(type, record);
    },
  };
}
