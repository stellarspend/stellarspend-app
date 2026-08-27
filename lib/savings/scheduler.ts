/**
 * lib/savings/scheduler.ts
 *
 * Manages savings goals and scheduled contribution execution.
 * Provides functions for loading/saving goals and contributions to localStorage,
 * creating and advancing contribution schedules, and checking/executing due
 * recurring contributions against an available balance.
 */

import { Goal, GoalSchedule, Contribution } from '@/lib/types/savings';

const STORAGE_KEY = 'stellarspend_goals';
const CONTRIBUTIONS_KEY = 'stellarspend_contributions';

/**
 * Loads all goals from localStorage.
 * @returns {Goal[]} Array of goals, or empty array if none exist or on server.
 * Loads all savings goals from localStorage.
 * @returns An array of Goal objects, or an empty array if none are stored or on server-side.
 */
export function loadGoals(): Goal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Goal[];
  } catch {
    return [];
  }
}

/**
 * Saves goals to localStorage.
 * @param {Goal[]} goals - Array of goals to persist.
 * Persists the given savings goals to localStorage.
 * @param goals - The array of Goal objects to save.
 */
export function saveGoals(goals: Goal[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

/**
 * Loads all contributions from localStorage.
 * @returns {Contribution[]} Array of contributions, or empty array if none exist or on server.
 * Loads all contribution records from localStorage.
 * @returns An array of Contribution objects, or an empty array if none are stored or on server-side.
 */
export function loadContributions(): Contribution[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CONTRIBUTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Contribution[];
  } catch {
    return [];
  }
}

/**
 * Saves contributions to localStorage.
 * @param {Contribution[]} contributions - Array of contributions to persist.
 * Persists contribution records to localStorage.
 * @param contributions - The array of Contribution objects to save.
 */
export function saveContributions(contributions: Contribution[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONTRIBUTIONS_KEY, JSON.stringify(contributions));
}

/**
 * Adds a contribution and persists it.
 * @param {Contribution} contribution - Contribution to add.
 * Appends a single contribution to the persisted contribution list.
 * @param contribution - The Contribution to record.
 */
export function addContribution(contribution: Contribution): void {
  const existing = loadContributions();
  existing.push(contribution);
  saveContributions(existing);
}

/**
 * Creates a new goal schedule.
 * @param {'monthly' | 'yearly'} recurrence - How often the contribution recurs.
 * @param {number} amount - Contribution amount per period.
 * @returns {GoalSchedule} The created schedule.
 * Creates a new contribution schedule with the next due date calculated from today.
 * @param recurrence - How often contributions should occur ('monthly' or 'yearly').
 * @param amount - The contribution amount for each scheduled period.
 * @returns A new GoalSchedule with the computed next due date.
 */
export function createSchedule(
  recurrence: 'monthly' | 'yearly',
  amount: number,
): GoalSchedule {
  const now = new Date();
  let nextDueDate: Date;

  if (recurrence === 'monthly') {
    nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  } else {
    nextDueDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }

  return {
    nextDueDate: nextDueDate.toISOString(),
    amount,
    paused: false,
  };
}

/**
 * Returns the next due date for a schedule.
 * @param {GoalSchedule} schedule - The schedule to inspect.
 * @returns {Date} The next due date.
 * Returns the next due date for a given schedule.
 * @param schedule - The GoalSchedule to inspect.
 * @returns A Date object representing when the next contribution is due.
 */
export function getNextDueDate(schedule: GoalSchedule): Date {
  return new Date(schedule.nextDueDate);
}

/**
 * Advances a schedule to the next period.
 * @param {GoalSchedule} schedule - The current schedule.
 * @returns {GoalSchedule} The advanced schedule.
 * Advances a schedule to the next period after the current due date.
 * Rolls the due date forward by one month and records the execution timestamp.
 * @param schedule - The GoalSchedule to advance.
 * @returns A new GoalSchedule with the updated next due date and lastExecutedAt.
 */
export function advanceSchedule(schedule: GoalSchedule): GoalSchedule {
  const current = new Date(schedule.nextDueDate);
  let nextDueDate: Date;

  if (schedule.nextDueDate.slice(8, 10) === '31') {
    nextDueDate = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  } else {
    nextDueDate = new Date(
      current.getFullYear(),
      current.getMonth() + 1,
      current.getDate(),
    );
  }

  return {
    ...schedule,
    nextDueDate: nextDueDate.toISOString(),
    lastExecutedAt: new Date().toISOString(),
  };
}

/**
 * Checks goals for due contributions and executes them if funds are available.
 * @param {Goal[]} goals - Goals to evaluate.
 * @param {number} availableBalance - Currently available balance.
 * @returns {{ updatedGoals: Goal[]; executedContributions: Contribution[] }} Updated goals and contributions executed in this run.
 * Iterates through goals and executes any contributions whose schedules are due.
 * Skips paused goals, goals that have reached their target, and goals whose
 * scheduled amount exceeds the available balance.
 * @param goals - The current array of savings goals.
 * @param availableBalance - The user's available balance to fund contributions.
 * @returns An object with the updated goals array and an array of executed contributions.
 */
export function checkAndExecuteDueContributions(
  goals: Goal[],
  availableBalance: number,
): {
  updatedGoals: Goal[];
  executedContributions: Contribution[];
} {
  const now = new Date();
  const updatedGoals: Goal[] = [];
  const executedContributions: Contribution[] = [];

  for (const goal of goals) {
    if (!goal.schedule || goal.schedule.paused) {
      updatedGoals.push(goal);
      continue;
    }

    const nextDue = getNextDueDate(goal.schedule);
    if (nextDue > now || goal.currentAmount >= goal.targetAmount) {
      updatedGoals.push(goal);
      continue;
    }

    if (goal.schedule.amount > availableBalance) {
      updatedGoals.push(goal);
      continue;
    }

    const contribution: Contribution = {
      id: Math.random().toString(36).substring(2, 11),
      goalId: goal.id,
      amount: goal.schedule.amount,
      source: 'scheduled',
      createdAt: new Date(),
    };

    const updatedGoal: Goal = {
      ...goal,
      currentAmount: goal.currentAmount + goal.schedule.amount,
      schedule: advanceSchedule(goal.schedule),
    };

    updatedGoals.push(updatedGoal);
    executedContributions.push(contribution);
    addContribution(contribution);
    availableBalance -= goal.schedule.amount;
  }

  return { updatedGoals, executedContributions };
}
