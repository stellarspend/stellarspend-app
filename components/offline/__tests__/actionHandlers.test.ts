import {
  buildUpdatePayload,
  detectUpdateConflict,
  readQueuedUpdate,
  replayQueuedUpdates,
  resolveUpdateConflict,
  valuesEqual,
  type ReplayResult,
  type SyncAdapter,
  type VersionedRecord,
} from "../actionHandlers";

/** Builds a versioned record without tripping excess-property checks. */
function record(shape: Record<string, unknown>): VersionedRecord {
  return shape as unknown as VersionedRecord;
}

describe("actionHandlers - versioned offline updates", () => {
  it("captures the record snapshot and last-modified marker when queueing", () => {
    const payload = buildUpdatePayload(
      record({ id: "budget_1", name: "Groceries", amount: 500, updatedAt: "2026-01-01T00:00:00.000Z" }),
      { amount: 600 },
    );

    expect(payload.id).toBe("budget_1");
    expect(payload.baseVersion).toBe("2026-01-01T00:00:00.000Z");
    expect(payload.base).toMatchObject({ name: "Groceries", amount: 500 });
    expect(payload.changes).toEqual({ amount: 600 });
    expect(payload.legacy).toBe(false);
  });

  it("reads legacy payloads queued before versioning as a change set", () => {
    const payload = readQueuedUpdate({ id: "budget_1", name: "Groceries", amount: 600 });

    expect(payload).not.toBeNull();
    expect(payload?.legacy).toBe(true);
    expect(payload?.base).toBeNull();
    expect(payload?.changes).toEqual({ name: "Groceries", amount: 600 });
  });

  it("auto-merges edits to genuinely different fields", () => {
    const payload = buildUpdatePayload(
      record({ id: "budget_1", name: "Groceries", amount: 500 }),
      { amount: 600 },
    );
    const current = record({ id: "budget_1", name: "Groceries plus", amount: 500 });

    const detection = detectUpdateConflict(payload, current);

    expect(detection.status).toBe("apply");
    expect(detection.conflicts).toEqual([]);
    expect(detection.merged.amount).toBe(600);
    expect(detection.merged.name).toBe("Groceries plus");
    expect(detection.autoMerged).toContain("amount");
  });

  it("raises a conflict when both devices changed the same field differently", () => {
    const payload = buildUpdatePayload(
      record({ id: "budget_1", name: "Groceries", amount: 500 }),
      { amount: 600 },
    );
    const current = record({ id: "budget_1", name: "Groceries", amount: 750 });

    const detection = detectUpdateConflict(payload, current);

    expect(detection.status).toBe("conflict");
    expect(detection.conflicts).toEqual([{ field: "amount", mine: 600, theirs: 750 }]);
    // Nothing is overwritten while the conflict is unresolved.
    expect(detection.merged.amount).toBe(750);
  });

  it("does not ask when both devices set a field to the same value", () => {
    const payload = buildUpdatePayload(
      record({ id: "budget_1", amount: 500 }),
      { amount: 600 },
    );
    const current = record({ id: "budget_1", amount: 600 });

    const detection = detectUpdateConflict(payload, current);

    expect(detection.status).toBe("apply");
    expect(detection.conflicts).toEqual([]);
  });

  it("keeps safe fields and applies the user's choice for conflicting ones", () => {
    const payload = buildUpdatePayload(
      record({ id: "budget_1", amount: 500, category: "fun" }),
      { amount: 600, category: "food" },
    );
    const current = record({ id: "budget_1", amount: 750, category: "travel" });

    const detection = detectUpdateConflict(payload, current);
    expect(detection.conflicts.map((c) => c.field).sort()).toEqual(["amount", "category"]);

    const chosen = resolveUpdateConflict(
      detection,
      { strategy: "choose_fields", choices: { amount: "mine", category: "theirs" } },
      "2026-02-01T00:00:00.000Z",
    );

    expect(chosen.changed).toBe(true);
    expect(chosen.record.amount).toBe(600);
    expect(chosen.record.category).toBe("travel");
    expect(chosen.record.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("supports keep-mine and keep-others for every conflicting field", () => {
    const payload = buildUpdatePayload(
      record({ id: "budget_1", amount: 500 }),
      { amount: 600 },
    );
    const current = record({ id: "budget_1", amount: 750 });
    const detection = detectUpdateConflict(payload, current);

    const mine = resolveUpdateConflict(detection, { strategy: "keep_mine" }, "now");
    expect(mine.record.amount).toBe(600);

    const theirs = resolveUpdateConflict(detection, { strategy: "keep_theirs" }, "now");
    expect(theirs.record.amount).toBe(750);
    expect(theirs.changed).toBe(false);
  });

  it("falls back to the record timestamp for legacy payloads", () => {
    const legacy = readQueuedUpdate({ id: "budget_1", amount: 600 });
    expect(legacy).not.toBeNull();

    const unchanged = detectUpdateConflict(
      legacy as NonNullable<typeof legacy>,
      record({ id: "budget_1", amount: 500, updatedAt: "2026-01-01T00:00:00.000Z" }),
      1_800_000_000_000,
    );
    expect(unchanged.status).toBe("apply");

    const changedElsewhere = detectUpdateConflict(
      legacy as NonNullable<typeof legacy>,
      record({ id: "budget_1", amount: 750, updatedAt: "2026-06-01T00:00:00.000Z" }),
      1_700_000_000_000,
    );
    expect(changedElsewhere.status).toBe("conflict");
    expect(changedElsewhere.conflicts[0].field).toBe("amount");
  });

  it("treats structurally equal values as unchanged", () => {
    expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(valuesEqual(new Date("2026-01-01"), new Date("2026-01-01"))).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("actionHandlers - replay", () => {
  const currentBudgets: Record<string, Record<string, unknown>> = {
    budget_merge: { id: "budget_merge", name: "Groceries", amount: 500 },
    budget_clash: { id: "budget_clash", name: "Transport", amount: 100 },
  };

  function makeAdapter(): jest.Mocked<SyncAdapter> {
    return {
      supports: jest.fn((type: string) => type.startsWith("UPDATE_")),
      loadCurrent: jest.fn(async (_type: string, id: string) => {
        const found = currentBudgets[id];
        return found ? record(found) : null;
      }),
      save: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<SyncAdapter>;
  }

  it("applies safe updates, prompts on conflicts and skips unknown actions", async () => {
    const adapter = makeAdapter();
    const actions = [
      {
        id: "a1",
        type: "UPDATE_BUDGET",
        description: "Update budget: Groceries",
        timestamp: 1,
        data: buildUpdatePayload(record(currentBudgets.budget_merge), { amount: 600 }),
      },
      {
        id: "a2",
        type: "UPDATE_BUDGET",
        description: "Update budget: Transport",
        timestamp: 2,
        data: buildUpdatePayload(
          record({ id: "budget_clash", name: "Transport", amount: 100 }),
          { amount: 300 },
        ),
      },
      {
        id: "a3",
        type: "CREATE_BUDGET",
        description: "Create budget",
        timestamp: 3,
        data: { name: "New" },
      },
    ];

    // Simulate the other device having changed budget_clash first.
    currentBudgets.budget_clash = { id: "budget_clash", name: "Transport", amount: 250 };

    const result: ReplayResult = await replayQueuedUpdates(actions, adapter);

    expect(result.appliedIds).toEqual(["a1"]);
    expect(result.skippedIds).toEqual(["a3"]);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].recordId).toBe("budget_clash");
    expect(result.prompts[0].detection.conflicts[0].field).toBe("amount");
    expect(adapter.save).toHaveBeenCalledTimes(1);
    expect(adapter.save).toHaveBeenCalledWith(
      "UPDATE_BUDGET",
      expect.objectContaining({ id: "budget_merge", amount: 600 }),
    );
  });

  it("reports a failure when the record no longer exists", async () => {
    const adapter = makeAdapter();
    adapter.loadCurrent.mockResolvedValueOnce(null);

    const result = await replayQueuedUpdates(
      [
        {
          id: "gone",
          type: "UPDATE_BUDGET",
          description: "Update deleted budget",
          timestamp: 1,
          data: buildUpdatePayload(record({ id: "missing", amount: 1 }), { amount: 2 }),
        },
      ],
      adapter,
    );

    expect(result.appliedIds).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].actionId).toBe("gone");
  });
});
