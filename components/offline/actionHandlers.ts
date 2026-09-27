/**
 * components/offline/actionHandlers.ts
 *
 * Version-aware replay for edits made on more than one device (Issue #115).
 *
 * When a user changes the same budget/goal on their phone (offline) and on
 * their laptop (online) before the phone reconnects, a plain "replay the queue
 * in order" would silently clobber one of the two edits. Instead, every queued
 * update carries:
 *
 *   - `changes`     the fields the user changed while offline
 *   - `base`        a snapshot of the record when the edit was queued
 *   - `baseVersion` the record's `updatedAt` marker at that moment
 *
 * On reconnect this module compares the queued edit with the record as it is
 * persisted *now*:
 *
 *   - a field only this device touched          -> applied automatically
 *   - a field only the other device touched      -> left as the other device set it
 *   - a field both devices changed differently   -> reported as a conflict so the
 *     UI can ask the user which value to keep
 *
 * The same detector is used for single-owner budgets/goals and for the
 * multi-actor flows (shared-budget approval #11, split bills #10), so those
 * do not need a second copy of the logic.
 *
 * This module is intentionally dependency-free (no React, no contract or
 * wallet imports) so the merge rules can be unit tested on their own.
 */

/** A record the offline queue can compare against, keyed by its stable id. */
export interface VersionedRecord {
  id: string;
  /** Last-modified marker written by the contract/local persistence layer. */
  updatedAt?: string;
}

/** The payload a versioned update stores in the offline queue. */
export interface QueuedUpdatePayload {
  id: string;
  changes: Record<string, unknown>;
  /** Snapshot of the record when the edit was queued (three-way merge base). */
  base: Record<string, unknown> | null;
  /** `updatedAt` of the base snapshot, when known. */
  baseVersion: string | null;
  /** True for payloads that predate the versioned format. */
  legacy: boolean;
}

/** One field that both devices changed to different values. */
export interface FieldConflict {
  field: string;
  mine: unknown;
  theirs: unknown;
}

/** Outcome of comparing a queued edit with the currently persisted record. */
export interface ConflictDetection {
  /** `"conflict"` when at least one field needs the user to choose. */
  status: "apply" | "conflict";
  /** The current record with every safe (non-conflicting) offline edit merged in. */
  merged: Record<string, unknown>;
  /** The record exactly as it is persisted right now. */
  current: Record<string, unknown>;
  /** Fields both devices changed differently; empty when `status` is `"apply"`. */
  conflicts: FieldConflict[];
  /** Fields applied automatically because only this device touched them. */
  autoMerged: string[];
}

/** How the user settled a conflict. */
export type ConflictStrategy = "keep_mine" | "keep_theirs" | "choose_fields";

/** The user's decision for a conflict. */
export interface ConflictResolution {
  strategy: ConflictStrategy;
  /** Required for `"choose_fields"`: a per-field choice of which value to keep. */
  choices?: Record<string, "mine" | "theirs">;
}

/** Action types whose payloads update an existing, versioned record. */
export const VERSIONED_UPDATE_TYPES = [
  "UPDATE_BUDGET",
  "UPDATE_GOAL",
  "UPDATE_SHARED_BUDGET",
  "UPDATE_SPLIT_BILL",
] as const;

export type VersionedUpdateType = (typeof VERSIONED_UPDATE_TYPES)[number];

/** Plain-language labels shown to non-technical users in the resolution UI. */
export const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  amount: "Amount",
  category: "Category",
  asset: "Asset",
  startDate: "Start date",
  endDate: "End date",
  targetAmount: "Savings target",
  currentAmount: "Saved so far",
  deadline: "Deadline",
  recurrence: "How often you save",
  description: "Description",
  status: "Status",
  totalAmount: "Total",
  shares: "Who owes what",
};

/** Fields that are never part of a user-facing conflict. */
const IGNORED_FIELDS = new Set(["id", "updatedAt", "createdAt"]);

/** Returns the plain-language label for a changed field. */
export function labelForField(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Returns true when two persisted values should be treated as equal. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date || b instanceof Date) {
    const left = a instanceof Date ? a.getTime() : a;
    const right = b instanceof Date ? b.getTime() : b;
    return Object.is(left, right);
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/** Returns true when `type` is an action this module knows how to replay. */
export function isVersionedUpdateType(type: string): type is VersionedUpdateType {
  return (VERSIONED_UPDATE_TYPES as readonly string[]).includes(type);
}

/**
 * Builds the offline payload for a versioned update, capturing the record's
 * current values and last-modified marker as the merge base.
 *
 * @param record - The record as this device last saw it.
 * @param changes - The fields the user just changed.
 */
export function buildUpdatePayload(
  record: VersionedRecord,
  changes: Record<string, unknown>,
): QueuedUpdatePayload {
  return {
    id: record.id,
    changes: { ...changes },
    base: { ...(record as unknown as Record<string, unknown>) },
    baseVersion: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
}

/**
 * Normalises a queued action payload into a {@link QueuedUpdatePayload}.
 *
 * Actions queued before this issue only carried `{ id, ...fields }`; those are
 * read as a change set with no base snapshot so already-queued work is not lost.
 */
export function readQueuedUpdate(data: unknown): QueuedUpdatePayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const raw = data as Record<string, unknown>;
  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  const rawChanges = raw.changes;
  const hasChanges =
    rawChanges !== null && typeof rawChanges === "object" && !Array.isArray(rawChanges);

  const changes: Record<string, unknown> = hasChanges
    ? { ...(rawChanges as Record<string, unknown>) }
    : Object.fromEntries(
        Object.entries(raw).filter(
          ([key]) => key !== "id" && key !== "base" && key !== "baseVersion",
        ),
      );

  const rawBase = raw.base;
  const base =
    rawBase !== null && typeof rawBase === "object" && !Array.isArray(rawBase)
      ? { ...(rawBase as Record<string, unknown>) }
      : null;

  return {
    id,
    changes,
    base,
    baseVersion: typeof raw.baseVersion === "string" ? raw.baseVersion : null,
    legacy: !hasChanges,
  };
}

function changedFields(payload: QueuedUpdatePayload): string[] {
  return Object.keys(payload.changes).filter((field) => !IGNORED_FIELDS.has(field));
}

/**
 * Three-way comparison of a queued offline edit against the persisted record.
 *
 * @param payload - The queued update, including the snapshot it was based on.
 * @param current - The record as it is persisted right now.
 * @param queuedAt - When the action was queued. Used for legacy payloads that
 *   have no base snapshot: a record last modified after that time was changed
 *   somewhere else.
 */
export function detectUpdateConflict(
  payload: QueuedUpdatePayload,
  current: VersionedRecord,
  queuedAt?: number,
): ConflictDetection {
  const currentRecord = { ...(current as unknown as Record<string, unknown>) };
  const fields = changedFields(payload);
  const merged: Record<string, unknown> = { ...currentRecord };
  const conflicts: FieldConflict[] = [];
  const autoMerged: string[] = [];

  if (payload.base) {
    const base = payload.base;

    for (const field of fields) {
      const mine = payload.changes[field];
      const theirs = currentRecord[field];

      // Both sides already agree — nothing to apply and nothing to ask about.
      if (valuesEqual(mine, theirs)) continue;

      // This field was not actually changed by the offline edit.
      if (valuesEqual(base[field], mine)) continue;

      if (valuesEqual(base[field], theirs)) {
        // Only this device touched the field: safe to apply automatically.
        merged[field] = mine;
        autoMerged.push(field);
      } else {
        // Both devices changed it to different values: the user decides.
        conflicts.push({ field, mine, theirs });
      }
    }

    return {
      status: conflicts.length > 0 ? "conflict" : "apply",
      merged,
      current: currentRecord,
      conflicts,
      autoMerged,
    };
  }

  // No base snapshot (payload queued before versioning existed). Fall back to
  // "was the record modified elsewhere after this action was queued?".
  const differing = fields.filter(
    (field) => !valuesEqual(payload.changes[field], currentRecord[field]),
  );

  if (differing.length === 0) {
    return {
      status: "apply",
      merged,
      current: currentRecord,
      conflicts: [],
      autoMerged: [],
    };
  }

  const currentUpdatedAt = current.updatedAt ? Date.parse(current.updatedAt) : Number.NaN;
  const changedElsewhere =
    Number.isFinite(currentUpdatedAt) &&
    typeof queuedAt === "number" &&
    currentUpdatedAt > queuedAt;

  if (changedElsewhere) {
    return {
      status: "conflict",
      merged,
      current: currentRecord,
      conflicts: differing.map((field) => ({
        field,
        mine: payload.changes[field],
        theirs: currentRecord[field],
      })),
      autoMerged: [],
    };
  }

  for (const field of differing) {
    merged[field] = payload.changes[field];
  }

  return {
    status: "apply",
    merged,
    current: currentRecord,
    conflicts: [],
    autoMerged: differing,
  };
}

/**
 * Applies the user's decision to a detected conflict.
 *
 * Safe, non-conflicting offline changes are always kept; the decision only
 * governs the fields both devices edited.
 *
 * @returns The record to persist and whether anything actually needs writing.
 */
export function resolveUpdateConflict(
  detection: ConflictDetection,
  resolution: ConflictResolution,
  now: string,
): { record: Record<string, unknown>; changed: boolean } {
  const record: Record<string, unknown> = { ...detection.merged };
  let changed = detection.autoMerged.length > 0;

  for (const conflict of detection.conflicts) {
    const choice =
      resolution.strategy === "keep_mine"
        ? "mine"
        : resolution.strategy === "keep_theirs"
          ? "theirs"
          : (resolution.choices?.[conflict.field] ?? "theirs");

    if (choice === "mine") {
      record[conflict.field] = conflict.mine;
      changed = true;
    } else {
      record[conflict.field] = conflict.theirs;
    }
  }

  if (!changed) {
    return { record: { ...detection.current }, changed: false };
  }

  record.updatedAt = now;
  return { record, changed: true };
}

// ─── Replay orchestration ───────────────────────────────────────────────────

/** The subset of `OfflineProvider`'s queued action shape this module needs. */
export interface QueuedActionLike {
  id: string;
  type: string;
  description: string;
  data: unknown;
  timestamp: number;
}

/** A conflict handed back to the UI so the user can decide what to keep. */
export interface ConflictPrompt {
  actionId: string;
  type: string;
  recordId: string;
  /** Human label used in the resolution dialog. */
  label: string;
  queuedAt: number;
  payload: QueuedUpdatePayload;
  detection: ConflictDetection;
}

/** How the sync layer reads and writes one kind of versioned record. */
export interface SyncAdapter {
  supports(type: string): boolean;
  loadCurrent(type: string, id: string): Promise<VersionedRecord | null>;
  save(type: string, record: Record<string, unknown>): Promise<void>;
}

export interface ReplayResult {
  /** Actions applied (or auto-merged) that can leave the queue. */
  appliedIds: string[];
  /** Actions that need a user decision before they can be applied. */
  prompts: ConflictPrompt[];
  /** Actions this build cannot replay yet; they stay queued untouched. */
  skippedIds: string[];
  /** Actions that failed for another reason; they stay queued. */
  failures: { actionId: string; reason: string }[];
}

/**
 * Replays queued versioned updates with conflict detection.
 *
 * Nothing is written for an action that conflicts — it is reported back as a
 * {@link ConflictPrompt} so the UI can ask the user first.
 */
export async function replayQueuedUpdates(
  actions: QueuedActionLike[],
  adapter: SyncAdapter,
): Promise<ReplayResult> {
  const result: ReplayResult = {
    appliedIds: [],
    prompts: [],
    skippedIds: [],
    failures: [],
  };

  for (const action of actions) {
    if (!isVersionedUpdateType(action.type) || !adapter.supports(action.type)) {
      result.skippedIds.push(action.id);
      continue;
    }

    const payload = readQueuedUpdate(action.data);
    if (!payload) {
      result.failures.push({
        actionId: action.id,
        reason: `Queued ${action.type} action has an unreadable payload.`,
      });
      continue;
    }

    try {
      const current = await adapter.loadCurrent(action.type, payload.id);
      if (!current) {
        result.failures.push({
          actionId: action.id,
          reason: `Record ${payload.id} no longer exists.`,
        });
        continue;
      }

      const detection = detectUpdateConflict(payload, current, action.timestamp);

      if (detection.status === "apply") {
        await adapter.save(action.type, detection.merged);
        result.appliedIds.push(action.id);
        continue;
      }

      result.prompts.push({
        actionId: action.id,
        type: action.type,
        recordId: payload.id,
        label: buildRecordLabel(action, payload),
        queuedAt: action.timestamp,
        payload,
        detection,
      });
    } catch (error) {
      result.failures.push({
        actionId: action.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/** Applies the user's decision for one conflict prompt. */
export async function applyConflictChoice(
  prompt: ConflictPrompt,
  resolution: ConflictResolution,
  adapter: SyncAdapter,
  now: string,
): Promise<{ record: Record<string, unknown>; changed: boolean }> {
  const outcome = resolveUpdateConflict(prompt.detection, resolution, now);
  if (outcome.changed) {
    await adapter.save(prompt.type, outcome.record);
  }
  return outcome;
}

function buildRecordLabel(action: QueuedActionLike, payload: QueuedUpdatePayload): string {
  const name = payload.changes.name ?? payload.base?.name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name;
  }
  const description = payload.changes.description ?? payload.base?.description;
  if (typeof description === "string" && description.trim().length > 0) {
    return description;
  }
  return action.description || payload.id;
}
