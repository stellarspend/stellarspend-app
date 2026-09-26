/**
 * Issue #113: goal.recurrence was captured on creation but nothing ever
 * executed a contribution when the schedule came due, and round-up rules
 * could be enabled but nothing ever computed or applied a round-up from a
 * real transaction. This file existed already (createSchedule,
 * checkAndExecuteDueContributions) but was never imported anywhere in the
 * app — these tests cover it directly, plus the new applyRoundUpToGoals.
 */
import {
  createSchedule,
  advanceSchedule,
  checkAndExecuteDueContributions,
  applyRoundUpToGoals,
  loadContributions,
  saveContributions,
} from "../scheduler";
import type { Goal } from "@/lib/types/savings";

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal_1",
    name: "New Laptop",
    targetAmount: 1000,
    currentAmount: 100,
    deadline: "2099-12-31",
    recurrence: "monthly",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("createSchedule", () => {
  it("computes a next due date one month out for monthly recurrence", () => {
    const schedule = createSchedule("monthly", 50);
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    expect(new Date(schedule.nextDueDate).getMonth()).toBe(expected.getMonth());
    expect(schedule.amount).toBe(50);
    expect(schedule.paused).toBe(false);
  });

  it("computes a next due date one year out for yearly recurrence", () => {
    const schedule = createSchedule("yearly", 200);
    const now = new Date();
    expect(new Date(schedule.nextDueDate).getFullYear()).toBe(now.getFullYear() + 1);
  });
});

describe("checkAndExecuteDueContributions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("executes a contribution for a goal whose schedule is due", () => {
    const dueGoal = makeGoal({
      schedule: { nextDueDate: new Date(Date.now() - 1000).toISOString(), amount: 50, paused: false },
    });

    const { updatedGoals, executedContributions } = checkAndExecuteDueContributions(
      [dueGoal],
      500,
    );

    expect(executedContributions).toHaveLength(1);
    expect(executedContributions[0]).toMatchObject({
      goalId: "goal_1",
      amount: 50,
      source: "scheduled",
    });
    expect(updatedGoals[0].currentAmount).toBe(150);
    // Schedule should have advanced to a new due date, not stayed due.
    expect(new Date(updatedGoals[0].schedule!.nextDueDate).getTime()).toBeGreaterThan(Date.now());
  });

  it("does not execute a contribution for a goal whose schedule is not yet due", () => {
    const futureGoal = makeGoal({
      schedule: { nextDueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(), amount: 50, paused: false },
    });

    const { updatedGoals, executedContributions } = checkAndExecuteDueContributions(
      [futureGoal],
      500,
    );

    expect(executedContributions).toHaveLength(0);
    expect(updatedGoals[0].currentAmount).toBe(100);
  });

  it("skips a paused schedule even if it is technically due", () => {
    const pausedGoal = makeGoal({
      schedule: { nextDueDate: new Date(Date.now() - 1000).toISOString(), amount: 50, paused: true },
    });

    const { executedContributions } = checkAndExecuteDueContributions([pausedGoal], 500);

    expect(executedContributions).toHaveLength(0);
  });

  it("skips a due goal when the available balance can't cover it", () => {
    const dueGoal = makeGoal({
      schedule: { nextDueDate: new Date(Date.now() - 1000).toISOString(), amount: 50, paused: false },
    });

    const { updatedGoals, executedContributions } = checkAndExecuteDueContributions(
      [dueGoal],
      10,
    );

    expect(executedContributions).toHaveLength(0);
    expect(updatedGoals[0].currentAmount).toBe(100);
  });

  it("skips a goal that has already reached its target", () => {
    const completedGoal = makeGoal({
      currentAmount: 1000,
      targetAmount: 1000,
      schedule: { nextDueDate: new Date(Date.now() - 1000).toISOString(), amount: 50, paused: false },
    });

    const { executedContributions } = checkAndExecuteDueContributions([completedGoal], 500);

    expect(executedContributions).toHaveLength(0);
  });

  it("leaves a goal with no schedule untouched", () => {
    const noScheduleGoal = makeGoal({ schedule: undefined });

    const { updatedGoals, executedContributions } = checkAndExecuteDueContributions(
      [noScheduleGoal],
      500,
    );

    expect(executedContributions).toHaveLength(0);
    expect(updatedGoals[0]).toEqual(noScheduleGoal);
  });
});

describe("applyRoundUpToGoals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("applies the round-up difference to a goal with an active round-up rule", () => {
    const goal = makeGoal({
      roundUpRule: { enabled: true, nearestUnit: 1, paused: false },
    });

    // 4.30 rounded up to nearest 1 is 5.00, so the round-up is 0.70.
    const { updatedGoals, appliedContributions } = applyRoundUpToGoals([goal], 4.3, "txhash123");

    expect(appliedContributions).toHaveLength(1);
    expect(appliedContributions[0]).toMatchObject({
      goalId: "goal_1",
      amount: 0.7,
      source: "round-up",
      transactionHash: "txhash123",
    });
    expect(updatedGoals[0].currentAmount).toBeCloseTo(100.7);
  });

  it("does nothing for a goal with round-up disabled", () => {
    const goal = makeGoal({
      roundUpRule: { enabled: false, nearestUnit: 1, paused: false },
    });

    const { updatedGoals, appliedContributions } = applyRoundUpToGoals([goal], 4.3);

    expect(appliedContributions).toHaveLength(0);
    expect(updatedGoals[0].currentAmount).toBe(100);
  });

  it("does nothing for a goal with round-up paused, even if enabled", () => {
    const goal = makeGoal({
      roundUpRule: { enabled: true, nearestUnit: 1, paused: true },
    });

    const { appliedContributions } = applyRoundUpToGoals([goal], 4.3);

    expect(appliedContributions).toHaveLength(0);
  });

  it("does nothing for a goal with no round-up rule at all", () => {
    const goal = makeGoal({ roundUpRule: undefined });

    const { appliedContributions } = applyRoundUpToGoals([goal], 4.3);

    expect(appliedContributions).toHaveLength(0);
  });

  it("does nothing when the transaction amount is already an exact multiple of the unit", () => {
    const goal = makeGoal({
      roundUpRule: { enabled: true, nearestUnit: 1, paused: false },
    });

    const { appliedContributions } = applyRoundUpToGoals([goal], 5);

    expect(appliedContributions).toHaveLength(0);
  });

  it("persists the applied round-up contribution so it's not lost on reload", () => {
    const goal = makeGoal({
      roundUpRule: { enabled: true, nearestUnit: 1, paused: false },
    });

    applyRoundUpToGoals([goal], 4.3, "txhash123");

    const stored = loadContributions();
    expect(stored).toHaveLength(1);
    expect(stored[0].source).toBe("round-up");
  });

  it("only applies to goals with an active rule when multiple goals are passed", () => {
    const activeGoal = makeGoal({
      id: "goal_1",
      roundUpRule: { enabled: true, nearestUnit: 1, paused: false },
    });
    const inactiveGoal = makeGoal({
      id: "goal_2",
      currentAmount: 50,
      roundUpRule: { enabled: true, nearestUnit: 1, paused: true },
    });

    const { updatedGoals, appliedContributions } = applyRoundUpToGoals(
      [activeGoal, inactiveGoal],
      4.3,
    );

    expect(appliedContributions).toHaveLength(1);
    expect(appliedContributions[0].goalId).toBe("goal_1");
    expect(updatedGoals.find((g) => g.id === "goal_2")!.currentAmount).toBe(50);
  });
});

describe("advanceSchedule", () => {
  it("records lastExecutedAt when advancing", () => {
    const schedule = createSchedule("monthly", 50);
    const advanced = advanceSchedule(schedule);
    expect(advanced.lastExecutedAt).toBeDefined();
    expect(new Date(advanced.nextDueDate).getTime()).toBeGreaterThan(new Date(schedule.nextDueDate).getTime());
  });
});

// Sanity check on the underlying persistence helpers used by both
// checkAndExecuteDueContributions and applyRoundUpToGoals.
describe("loadContributions / saveContributions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips contributions through localStorage", () => {
    expect(loadContributions()).toEqual([]);
    saveContributions([
      { id: "c1", goalId: "goal_1", amount: 10, source: "manual", createdAt: new Date() },
    ]);
    expect(loadContributions()).toHaveLength(1);
  });
});
