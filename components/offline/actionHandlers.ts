/**
 * Versioned offline-action handling for multi-device edits (Issue #115).
 *
 * When a user edits the same budget/goal on two devices, the offline queue's
 * replay must not blindly overwrite whatever is currently persisted. Instead of
 * a plain "last write wins" replay, every queued update carries the snapshot it
 * was based on (`base`) and this module runs a three-way comparison:
 *
 *   - fields only this device touched        -> applied automatically
 *   - fields only the other device touched   -> left alone
 *   - fields both devices touched differently -> surfaced to the user
 *
 * The user then chooses, per field, which value to keep. The same detector is
 * registered for single-owner budgets/goals and for the multi-actor flows
 * (shared budgets and split bills), so `#10`/`#11` do not need their own copy.
 */

/** Anything the sync layer can version and compare. */
export interface VersionedRecord {
  id: string;
  updatedAt?: string;
}

/** The payload an update action stores in the offline queue. */
export interface QueuedUpdate {
  /** Id of the record being updated. */
  id: string;
  /** Fields the user changed while offline. */
  changes: Record<string, unknown>;
  /** Snapshot of the record when the edit was queued (three-way merge base). */
  base: Record<string, unknown> | null;
  /** `updatedAt` of the base snapshot, when known. */
  baseVersion: string | null;
  /** True for payloads queued before `changes`/`base` were introduced. */
  legacy: boolean;
}

/** A single field that two devices changed to different values. */
export interface FieldConflict {
  field: string;
  /** The value queued on this device while offline. */
  mine: unknown;
  /** The value currently persisted (i.e. from the other device). */
  theirs: unknown;
}

/** Result of comparing a queued update against the currently persisted record. */
export interface ConflictDetectionResult {
  /** `"conflict"` when at least one field needs a user decision. */
  status: "apply" | "conflict";
  /** Current record with every non-conflicting offline change merged in. */
  record: VersionedRecord;
  /** The record as it is persisted right now (the other device's copy). */
  current: VersionedRecord;
  /** Conflicting fields; empty when `status` is `"apply"`. */
  conflicts: FieldConflict[];
  /** Fields merged automatically because only this device touched them. */
  autoMergedFields: string[];
}

/** How the user decided to settle a conflict. */
export type ConflictStrategy = "keep_mine" | "keep_theirs" | "choose_fields";

export interface ConflictResolution {
  strategy: ConflictStrategy;
  /** Per-field choices, required when `strategy` is `"choose_fields"`. */
  choices?: Record<string, "mine" | "theirs">;
}

/** Metadata fields that never take part in a conflict. */
const IGNORED_FIELDS = new Set(["id", "updatedAt", "createdAt"]);

/** Compares two persisted values, treating arrays/objects structurally. */
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

function readField(record: VersionedRecord, field: string): unknown {
  return (record as unknown as Record<string, unknown>)[field];
}

function writeField(
  record: VersionedRecord,
  field: string,
  value: unknown,
): VersionedRecord {
  return { ...(record as unknown as Record<string, unknown>), [field]: value } as VersionedRecord;
}

/**
 * Normalises a queued action payload into a {@link QueuedUpdate}.
 *
 * Payloads queued before this issue only carried `{ id, ...fields }`; those are
 * read as a change set with no base snapshot so already-queued work is not lost.
 */
export function parseQueuedUpdate(data: unknown): QueuedUpdate | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const raw = data as Record<string, unknown>;
  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  const rawChanges = raw.changes;
  const hasExplicitChanges =
    rawChanges !== null && typeof rawChanges === "object" && !Array.isArray(rawChanges);

  const changes: Record<string, unknown> = hasExplicitChanges
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
    legacy: !hasExplicitChanges,
  };
}

function updateFields(update: QueuedUpdate): string[] {
  return Object.keys(update.changes).filter((field) => !IGNORED_FIELDS.has(field));
}

/**
 * Three-way comparison of a queued offline edit against the persisted record.
 *
 * @param update - The queued update, including the snapshot it was based on.
 * @param current - The record as persisted right now.
 * @param options.queuedAt - When the action was queued (used for legacy payloads
 *   that have no base snapshot: a record modified after that timestamp is
 *   treated as changed elsewhere).
 */
export function detectConflicts(
  update: QueuedUpdate,
  current: VersionedRecord,
  options: { queuedAt?: number } = {},
): ConflictDetectionResult {
  const fields = updateFields(update);
  const conflicts: FieldConflict[] = [];
  const autoMergedFields: string[] = [];
  let record = current;

  if (update.base) {
    const base = update.base;

    for (const field of fields) {
      const mine = update.changes[field];
      const theirs = readField(current, field);

      // Both devices already agree — nothing to apply or ask about.
      if (valuesEqual(mine, theirs)) continue;

      // This field was not actually changed by the offline edit.
      if (valuesEqual(base[field], mine)) continue;

      if (valuesEqual(base[field], theirs)) {
        // Only this device touched it: safe to apply automatically.
        record = writeField(record, field, mine);
        autoMergedFields.push(field);
      } else {
        // Both devices changed it to different values: the user decides.
        conflicts.push({ field, mine, theirs });
      }
    }

    return {
      status: conflicts.length > 0 ? "conflict" : "apply",
      record,
      current,
      conflicts,
      autoMergedFields,
    };
  }

  // No base snapshot (payload queued before versioning existed). Fall back to
  // "was the record touched after this action was queued?".
  const differing = fields.filter(
    (field) => !valuesEqual(update.changes[field], readField(current, field)),
  );

  if (differing.length === 0) {
    return {
      status: "apply",
      record,
      current,
      conflicts: [],
      autoMergedFields: [],
    };
  }

  const currentUpdatedAt = current.updatedAt
    ? Date.parse(current.updatedAt)
    : Number.NaN;
  const recordChangedElsewhere =
    Number.isFinite(currentUpdatedAt) &&
    typeof options.queuedAt === "number" &&
    currentUpdatedAt > options.queuedAt;

  if (recordChangedElsewhere) {
    return {
      status: "conflict",
      record,
      current,
      conflicts: differing.map((field) => ({
        field,
        mine: update.changes[field],
        theirs: readField(current, field),
      })),
      autoMergedFields: [],
    };
  }

  for (const field of differing) {
    record = writeField(record, field, update.changes[field]);
  }

  return {
    status: "apply",
    record,
    current,
    conflicts: [],
    autoMergedFields: differing,
  };
}

/**
 * Applies the user's decision to a detected conflict.
 *
 * Non-conflicting offline changes are always kept; the decision only governs
 * the fields both devices edited.
 */
export function resolveConflicts(
  detection: ConflictDetectionResult,
  resolution: ConflictResolution,
  options: { updatedAt: string },
): { record: VersionedRecord; shouldWrite: boolean } {
  let record = detection.record;
  let shouldWrite = detection.autoMergedFields.length > 0;

  for (const conflict of detection.conflicts) {
    const choice =
      resolution.strategy === "keep_mine"
        ? "mine"
        : resolution.strategy === "keep_theirs"
          ? "theirs"
          : (resolution.choices?.[conflict.field] ?? "theirs");

    if (choice === "mine") {
      record = writeField(record, conflict.field, conflict.mine);
      shouldWrite = true;
    } else {
      record = writeField(record, conflict.field, conflict.theirs);
    }
  }

  if (!shouldWrite) {
    return { record: detection.current, shouldWrite: false };
  }

  return {
    record: { ...record, updatedAt: options.updatedAt },
    shouldWrite: true,
  };
}

// ─── Replay dispatch ───────────────────────────────────────────────────────

/** Action types whose payloads update an existing, versioned record. */
export const VERSIONED_UPDATE_TYPES = [
  "UPDATE_BUDGET",
  "UPDATE_GOAL",
  "UPDATE_SHARED_BUDGET",
  "UPDATE_SPLIT_BILL",
] as const;

export type VersionedUpdateType = (typeof VERSIONED_UPDATE_TYPES)[number];

export function isVersionedUpdateType(type: string): type is VersionedUpdateType {
  return (VERSIONED_UPDATE_TYPES as readonly string[]).includes(type);
}

/** Shape of the entries stored by `OfflineProvider`. */
export interface QueuedActionLike {
  id: string;
  type: string;
  description: string;
  data: unknown;
  timestamp: number;
}

/** A conflict handed to the UI so the user can decide what to keep. */
export interface ConflictPrompt {
  actionId: string;
  type: VersionedUpdateType;
  recordId: string;
  /** Human label used in the resolution dialog. */
  label: string;
  queuedAt: number;
  update: QueuedUpdate;
  detection: ConflictDetectionResult;
}

/** How the sync layer reads and writes a record type. */
export interface SyncAdapter {
  supports(type: VersionedUpdateType): boolean;
  fetchCurrent(
    type: VersionedUpdateType,
    id: string,
  ): Promise<VersionedRecord | null>;
  apply(type: VersionedUpdateType, record: VersionedRecord): Promise<void>;
}

export interface ReplayOutcome {
  /** Actions that were applied (or auto-merged) and can leave the queue. */
  appliedIds: string[];
  /** Actions that need a user decision before they can be applied. */
  conflictPrompts: ConflictPrompt[];
  /** Actions this build cannot replay yet; they stay queued untouched. */
  skippedIds: string[];
  /** Actions that failed for another reason; they stay queued. */
  failures: { actionId: string; reason: string }[];
}

/**
 * Replays the offline queue with version checks.
 *
 * Nothing is written for an action that conflicts — it is reported back as a
 * {@link ConflictPrompt} so the UI can ask the user first.
 */
export async function replayQueuedActions(
  actions: QueuedActionLike[],
  adapter: SyncAdapter,
): Promise<ReplayOutcome> {
  const outcome: ReplayOutcome = {
    appliedIds: [],
    conflictPrompts: [],
    skippedIds: [],
    failures: [],
  };

  for (const action of actions) {
    if (!isVersionedUpdateType(action.type) || !adapter.supports(action.type)) {
      outcome.skippedIds.push(action.id);
      continue;
    }

    const update = parseQueuedUpdate(action.data);
    if (!update) {
      outcome.failures.push({
        actionId: action.id,
        reason: `Queued ${action.type} action has an unreadable payload.`,
      });
      continue;
    }

    try {
      const current = await adapter.fetchCurrent(action.type, update.id);
      if (!current) {
        outcome.failures.push({
          actionId: action.id,
          reason: `Record ${update.id} no longer exists.`,
        });
        continue;
      }

      const detection = detectConflicts(update, current, {
        queuedAt: action.timestamp,
      });

      if (detection.status === "apply") {
        await adapter.apply(action.type, detection.record);
        outcome.appliedIds.push(action.id);
        continue;
      }

      outcome.conflictPrompts.push({
        actionId: action.id,
        type: action.type,
        recordId: update.id,
        label: buildRecordLabel(action, update),
        queuedAt: action.timestamp,
        update,
        detection,
      });
    } catch (error) {
      outcome.failures.push({
        actionId: action.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return outcome;
}

/** Applies the user's decision for one conflict and clears its queued action. */
export async function applyConflictResolution(
  prompt: ConflictPrompt,
  resolution: ConflictResolution,
  adapter: SyncAdapter,
  options: { updatedAt: string },
): Promise<{ record: VersionedRecord; shouldWrite: boolean }> {
  const { record, shouldWrite } = resolveConflicts(
    prompt.detection,
    resolution,
    options,
  );

  if (shouldWrite) {
    await adapter.apply(prompt.type, record);
  }

  return { record, shouldWrite };
}

function buildRecordLabel(
  action: QueuedActionLike,
  update: QueuedUpdate,
): string {
  const name = update.changes.name ?? update.base?.name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name;
  }
  return action.description || update.id;
}
