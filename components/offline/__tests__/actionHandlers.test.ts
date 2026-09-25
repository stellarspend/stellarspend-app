import {
  detectConflicts,
  parseQueuedUpdate,
  replayQueuedActions,
  resolveConflicts,
  valuesEqual,
  type ConflictPrompt,
  type QueuedActionLike,
  type SyncAdapter,
  type VersionedRecord,
  type VersionedUpdateType,
} from "../actionHandlers";

function record(values: Record<string, unknown>): VersionedRecord {
  return values as VersionedRecord;
}

const BASE_TIME = Date.parse("2026-03-01T10:00:00.000Z");

const baseBudget = {
  id: "budget_1",
  updatedAt: "2026-03-01T10:00:00.000Z",
  name: "Groceries",
  amount: 500,
  category: "food",
};

const queuedAt = BASE_TIME + 60_000;

describe("parseQueuedUpdate", () => {
  it("reads the new payload shape with an explicit change set and base", () => {
    const parsed = parseQueuedUpdate({
      id: "budget_1",
      changes: { amount: 650 },
      base: baseBudget,
      baseVersion: baseBudget.updatedAt,
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("budget_1");
    expect(parsed?.changes).toEqual({ amount: 650 });
    expect(parsed?.base).toEqual(baseBudget);
    expect(parsed?.legacy).toBe(false);
  });

  it("still reads payloads queued before versioning existed", () => {
    const parsed = parseQueuedUpdate({
      id: "budget_1",
      name: "Groceries",
      amount: 650,
    });

    expect(parsed?.legacy).toBe(true);
    expect(parsed?.changes).toEqual({ name: "Groceries", amount: 650 });
    expect(parsed?.base).toBeNull();
  });

  it("ignores payloads without a record id", () => {
    expect(parseQueuedUpdate(null)).toBeNull();
    expect(parseQueuedUpdate("nope")).toBeNull();
    expect(parseQueuedUpdate({ amount: 10 })).toBeNull();
  });
});

describe("valuesEqual", () => {
  it("compares primitives, dates and structures", () => {
    expect(valuesEqual(5, 5)).toBe(true);
    expect(valuesEqual(5, "5")).toBe(false);
    expect(valuesEqual(new Date(1000), new Date(1000))).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(valuesEqual([1, 2], [2, 1])).toBe(false);
  });
});

describe("detectConflicts — two devices editing the same budget", () => {
  it("asks the user when both devices changed the same field differently", () => {
    const result = detectConflicts(
      {
        id: "budget_1",
        changes: { amount: 650 },
        base: baseBudget,
        baseVersion: baseBudget.updatedAt,
        legacy: false,
      },
      record({ ...baseBudget, amount: 800, updatedAt: "2026-03-01T11:00:00.000Z" }),
      { queuedAt },
    );

    expect(result.status).toBe("conflict");
    expect(result.conflicts).toEqual([{ field: "amount", mine: 650, theirs: 800 }]);
    expect(result.autoMergedFields).toEqual([]);
  });

  it("applies edits to different fields without asking anything", () => {
    const result = detectConflicts(
      {
        id: "budget_1",
        changes: { amount: 650 },
        base: baseBudget,
        baseVersion: baseBudget.updatedAt,
        legacy: false,
      },
      record({
        ...baseBudget,
        category: "household",
        updatedAt: "2026-03-01T11:00:00.000Z",
      }),
      { queuedAt },
    );

    expect(result.status).toBe("apply");
    expect(result.autoMergedFields).toEqual(["amount"]);
    expect(result.record).toMatchObject({ amount: 650, category: "household" });
  });

  it("keeps the other device's value for fields this device never touched", () => {
    const result = detectConflicts(
      {
        id: "budget_1",
        changes: { name: "Groceries" },
        base: baseBudget,
        baseVersion: baseBudget.updatedAt,
        legacy: false,
      },
      record({ ...baseBudget, amount: 900, updatedAt: "2026-03-01T11:00:00.000Z" }),
      { queuedAt },
    );

    expect(result.status).toBe("apply");
    expect(result.record.amount).toBe(900);
  });

  it("does not raise a conflict when both devices chose the same value", () => {
    const result = detectConflicts(
      {
        id: "budget_1",
        changes: { amount: 800 },
        base: baseBudget,
        baseVersion: baseBudget.updatedAt,
        legacy: false,
      },
      record({ ...baseBudget, amount: 800, updatedAt: "2026-03-01T11:00:00.000Z" }),
      { queuedAt },
    );

    expect(result.status).toBe("apply");
    expect(result.autoMergedFields).toEqual([]);
  });

  it("falls back to the queue timestamp for payloads without a base snapshot", () => {
    const changedElsewhere = detectConflicts(
      { id: "budget_1", changes: { amount: 650 }, base: null, baseVersion: null, legacy: true },
      record({ ...baseBudget, amount: 800, updatedAt: "2026-03-01T11:00:00.000Z" }),
      { queuedAt },
    );
    expect(changedElsewhere.status).toBe("conflict");

    const untouchedElsewhere = detectConflicts(
      { id: "budget_1", changes: { amount: 650 }, base: null, baseVersion: null, legacy: true },
      record({ ...baseBudget, updatedAt: "2026-03-01T09:00:00.000Z" }),
      { queuedAt },
    );
    expect(untouchedElsewhere.status).toBe("apply");
    expect(untouchedElsewhere.record.amount).toBe(650);
  });
});

describe("resolveConflicts", () => {
  const detection = detectConflicts(
    {
      id: "budget_1",
      changes: { amount: 650, category: "household" },
      base: baseBudget,
      baseVersion: baseBudget.updatedAt,
      legacy: false,
    },
    record({ ...baseBudget, amount: 800, updatedAt: "2026-03-01T11:00:00.000Z" }),
    { queuedAt },
  );

  it("keeps the offline values when the user chooses them", () => {
    const { record: resolved, shouldWrite } = resolveConflicts(
      detection,
      { strategy: "keep_mine" },
      { updatedAt: "2026-03-01T12:00:00.000Z" },
    );

    expect(shouldWrite).toBe(true);
    expect(resolved).toMatchObject({
      amount: 650,
      category: "household",
      updatedAt: "2026-03-01T12:00:00.000Z",
    });
  });

  it("keeps the other device's value for the contested field while still saving the auto-merged one", () => {
    const { record: resolved, shouldWrite } = resolveConflicts(
      detection,
      { strategy: "keep_theirs" },
      { updatedAt: "2026-03-01T12:00:00.000Z" },
    );

    expect(shouldWrite).toBe(true); // the non-conflicting category edit still lands
    expect(resolved.amount).toBe(800);
    expect(resolved.category).toBe("household");
  });

  it("writes nothing at all when there is nothing but the other device's values", () => {
    const singleFieldDetection = detectConflicts(
      {
        id: "budget_1",
        changes: { amount: 650 },
        base: baseBudget,
        baseVersion: baseBudget.updatedAt,
        legacy: false,
      },
      record({ ...baseBudget, amount: 800, updatedAt: "2026-03-01T11:00:00.000Z" }),
      { queuedAt },
    );

    const { record: resolved, shouldWrite } = resolveConflicts(
      singleFieldDetection,
      { strategy: "keep_theirs" },
      { updatedAt: "2026-03-01T12:00:00.000Z" },
    );

    expect(shouldWrite).toBe(false);
    expect(resolved.updatedAt).toBe("2026-03-01T11:00:00.000Z");
    expect(resolved.amount).toBe(800);
  });

  it("honours per-field choices", () => {
    const { record: resolved } = resolveConflicts(
      detection,
      { strategy: "choose_fields", choices: { amount: "mine", category: "theirs" } },
      { updatedAt: "2026-03-01T12:00:00.000Z" },
    );

    expect(resolved.amount).toBe(650);
    expect(resolved.category).toBe("food");
  });
});

describe("replayQueuedActions", () => {
  function createAdapter(records: VersionedRecord[]): SyncAdapter & {
    applied: { type: VersionedUpdateType; record: VersionedRecord }[];
  } {
    const applied: { type: VersionedUpdateType; record: VersionedRecord }[] = [];
    return {
      applied,
      supports: (type) => type !== "UPDATE_SPLIT_BILL",
      fetchCurrent: async (_type, id) =>
        records.find((candidate) => candidate.id === id) ?? null,
      apply: async (type, recordToApply) => {
        applied.push({ type, record: recordToApply });
      },
    };
  }

  function action(overrides: Partial<QueuedActionLike>): QueuedActionLike {
    return {
      id: "q1",
      type: "UPDATE_BUDGET",
      description: "Update budget: Groceries",
      data: null,
      timestamp: queuedAt,
      ...overrides,
    };
  }

  it("applies non-conflicting queued updates", async () => {
    const adapter = createAdapter([
      { ...baseBudget, category: "household", updatedAt: "2026-03-01T11:00:00.000Z" },
    ]);

    const outcome = await replayQueuedActions(
      [
        action({
          data: {
            id: "budget_1",
            changes: { amount: 650 },
            base: baseBudget,
            baseVersion: baseBudget.updatedAt,
          },
        }),
      ],
      adapter,
    );

    expect(outcome.appliedIds).toEqual(["q1"]);
    expect(outcome.conflictPrompts).toHaveLength(0);
    expect(adapter.applied).toHaveLength(1);
    expect(adapter.applied[0].record).toMatchObject({ amount: 650, category: "household" });
  });

  it("returns a prompt instead of overwriting when the same field was edited elsewhere", async () => {
    const adapter = createAdapter([
      { ...baseBudget, amount: 800, updatedAt: "2026-03-01T11:00:00.000Z" },
    ]);

    const outcome = await replayQueuedActions(
      [
        action({
          data: {
            id: "budget_1",
            changes: { amount: 650 },
            base: baseBudget,
            baseVersion: baseBudget.updatedAt,
          },
        }),
      ],
      adapter,
    );

    expect(outcome.appliedIds).toEqual([]);
    expect(adapter.applied).toHaveLength(0);
    expect(outcome.conflictPrompts).toHaveLength(1);
    expect(outcome.conflictPrompts[0].label).toBe("Groceries");
    expect(outcome.conflictPrompts[0].detection.conflicts[0]).toEqual({
      field: "amount",
      mine: 650,
      theirs: 800,
    });
  });

  it("skips action types this build cannot replay yet", async () => {
    const adapter = createAdapter([]);

    const outcome = await replayQueuedActions(
      [
        action({ id: "pay", type: "SEND_PAYMENT", data: { amount: 10 } }),
        action({
          id: "split",
          type: "UPDATE_SPLIT_BILL",
          data: { id: "split_1", changes: { totalAmount: 20 } },
        }),
      ],
      adapter,
    );

    expect(outcome.skippedIds).toEqual(["pay", "split"]);
    expect(outcome.failures).toHaveLength(0);
  });

  it("reports a failure when the edited record no longer exists", async () => {
    const outcome = await replayQueuedActions(
      [
        action({
          data: {
            id: "budget_missing",
            changes: { amount: 1 },
            base: baseBudget,
            baseVersion: baseBudget.updatedAt,
          },
        }),
      ],
      createAdapter([]),
    );

    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0].reason).toContain("no longer exists");
  });

  it("uses the same conflict logic for multi-actor shared budgets and split bills", async () => {
    const prompts: ConflictPrompt[] = [];

    for (const type of [
      "UPDATE_SHARED_BUDGET",
      "UPDATE_SPLIT_BILL",
      "UPDATE_GOAL",
    ] as VersionedUpdateType[]) {
      const adapter = createAdapter([
        { id: "record_1", updatedAt: "2026-03-01T11:00:00.000Z", amount: 200 },
      ]);
      // Force the type through the versioned path for this assertion.
      adapter.supports = () => true;

      const outcome = await replayQueuedActions(
        [
          action({
            type,
            id: `queued_${type}`,
            data: {
              id: "record_1",
              changes: { amount: 100 },
              base: { id: "record_1", amount: 50 },
              baseVersion: "2026-03-01T10:00:00.000Z",
            },
          }),
        ],
        adapter,
      );

      expect(outcome.conflictPrompts).toHaveLength(1);
      prompts.push(outcome.conflictPrompts[0]);
    }

    expect(prompts.map((prompt) => prompt.type)).toEqual([
      "UPDATE_SHARED_BUDGET",
      "UPDATE_SPLIT_BILL",
      "UPDATE_GOAL",
    ]);
    expect(prompts[0].detection.conflicts[0].field).toBe("amount");
  });
});
