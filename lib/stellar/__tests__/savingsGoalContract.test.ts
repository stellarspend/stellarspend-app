// Note: `jest` is used as a global (not imported from @jest/globals) because
// importing it disables jest.mock hoisting in this repo's SWC transform.
import { describe, expect, test, beforeEach } from '@jest/globals';

// @stellar/stellar-sdk ships ESM-only deps that jest cannot parse; these
// tests only exercise the local/mock fallback path (no
// NEXT_PUBLIC_SAVINGS_CONTRACT_ID configured), so a minimal mock is enough
// to let the module load without touching the real SDK.
jest.mock('@stellar/stellar-sdk', () => ({
  Contract: jest.fn(),
  TransactionBuilder: jest.fn(),
  Account: jest.fn(),
  scValToNative: jest.fn(),
  nativeToScVal: jest.fn(),
  Address: jest.fn(),
  rpc: {},
}));

jest.mock('@/lib/api/stellar/client', () => ({
  getSorobanServer: jest.fn(),
  getNetworkPassphrase: jest.fn(),
}));

jest.mock('../budgetContract', () => ({
  callContractView: jest.fn(),
  submitContractTx: jest.fn(),
  triggerNotification: jest.fn(),
}));

import {
  createGoal,
  contributeToGoal,
  getMockGoalsFallback,
  setMockGoalsFallback,
} from '../savingsGoalContract';
import { loadContributions } from '@/lib/savings/scheduler';

describe('createGoal (local/mock fallback — no contract configured)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('attaches no schedule for a one-time goal', async () => {
    const goal = await createGoal('G_TEST', {
      title: 'Trip',
      targetAmount: 500,
      deadline: '2099-01-01',
      recurrence: 'once',
    });

    expect(goal.schedule).toBeUndefined();
  });

  test('attaches a real schedule for a monthly goal with a schedule amount', async () => {
    // This is the core of issue #113: recurrence was captured on the form
    // but never turned into anything that could actually execute.
    const goal = await createGoal('G_TEST', {
      title: 'Emergency Fund',
      targetAmount: 2000,
      deadline: '2099-01-01',
      recurrence: 'monthly',
      scheduleAmount: 100,
    });

    expect(goal.schedule).toBeDefined();
    expect(goal.schedule!.amount).toBe(100);
    expect(goal.schedule!.paused).toBe(false);
  });

  test('does not attach a schedule for a monthly goal with no schedule amount provided', async () => {
    const goal = await createGoal('G_TEST', {
      title: 'Emergency Fund',
      targetAmount: 2000,
      deadline: '2099-01-01',
      recurrence: 'monthly',
    });

    expect(goal.schedule).toBeUndefined();
  });

  test('persists the created goal to the mock goal store', async () => {
    await createGoal('G_TEST', {
      title: 'Trip',
      targetAmount: 500,
      deadline: '2099-01-01',
      recurrence: 'once',
    });

    const stored = getMockGoalsFallback();
    expect(stored.some((g) => g.name === 'Trip')).toBe(true);
  });
});

describe('contributeToGoal (local/mock fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
    setMockGoalsFallback([
      {
        id: 'goal_1',
        name: 'Laptop',
        targetAmount: 1000,
        currentAmount: 0,
        deadline: '2099-01-01',
        recurrence: 'once',
        createdAt: new Date(),
      },
    ]);
  });

  test('records a Contribution with the given source (previously never recorded anything locally)', async () => {
    await contributeToGoal('', 'goal_1', 50, 'manual');

    const history = loadContributions();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ goalId: 'goal_1', amount: 50, source: 'manual' });
  });

  test('defaults to source "manual" when none is given', async () => {
    await contributeToGoal('', 'goal_1', 25);

    const history = loadContributions();
    expect(history[0].source).toBe('manual');
  });

  test('updates the goal balance in the mock store', async () => {
    await contributeToGoal('', 'goal_1', 50, 'manual');

    const [goal] = getMockGoalsFallback();
    expect(goal.currentAmount).toBe(50);
  });
});
