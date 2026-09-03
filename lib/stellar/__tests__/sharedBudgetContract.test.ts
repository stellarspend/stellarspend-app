// Note: `jest` is used as a global (not imported from @jest/globals) because
// importing it disables jest.mock hoisting in this repo's SWC transform.
import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';

// @stellar/stellar-sdk ships ESM-only deps (e.g. @noble/hashes) that jest
// cannot parse, so we mock the small surface the code under test uses.
jest.mock('@stellar/stellar-sdk', () => {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let seq = 0;
  return {
    StrKey: {
      isValidEd25519PublicKey: (value: unknown) =>
        typeof value === 'string' &&
        value.length === 56 &&
        value.startsWith('G') &&
        [...value].every((c) => ALPHABET.includes(c)),
    },
    Keypair: {
      random: () => ({
        publicKey: () =>
          'G' + Array.from({ length: 55 }, (_, i) => ALPHABET[(i + seq++) % 32]).join(''),
      }),
    },
  };
});

import { Keypair } from '@stellar/stellar-sdk';
import {
  createSharedBudget,
  fetchSharedBudgets,
  fetchPendingChanges,
  proposeBudgetChange,
  approveBudgetChange,
  rejectBudgetChange,
  subscribeToSharedBudgets,
  isSharedBudgetMember,
  isValidStellarAddress,
  describeBudgetChanges,
  SharedBudget,
  SharedBudgetInput,
} from '../sharedBudgetContract';

const SHARED_BUDGETS_KEY = 'stellarspend_shared_budgets';
const PENDING_CHANGES_KEY = 'stellarspend_pending_changes';

const alice = Keypair.random().publicKey();
const bob = Keypair.random().publicKey();
const carol = Keypair.random().publicKey();
const mallory = Keypair.random().publicKey();

function baseInput(overrides: Partial<SharedBudgetInput> = {}): SharedBudgetInput {
  return {
    name: 'Household',
    amount: 500,
    category: 'housing',
    asset: 'USDC',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    coOwners: [bob, carol],
    approvalThreshold: 2,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isValidStellarAddress', () => {
  test('accepts valid Stellar public keys', () => {
    expect(isValidStellarAddress(alice)).toBe(true);
    expect(isValidStellarAddress(Keypair.random().publicKey())).toBe(true);
  });

  test('rejects malformed addresses', () => {
    expect(isValidStellarAddress('not-an-address')).toBe(false);
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('G'.repeat(55))).toBe(false);
  });
});

describe('createSharedBudget', () => {
  test('creates a shared budget with co-owners and threshold', async () => {
    const budget = await createSharedBudget(alice, baseInput());

    expect(budget.isShared).toBe(true);
    expect(budget.ownerAddress).toBe(alice);
    expect(budget.coOwners).toEqual([bob, carol]);
    expect(budget.approvalThreshold).toBe(2);
  });

  test('clamps the threshold to the total number of members', async () => {
    const budget = await createSharedBudget(
      alice,
      baseInput({ approvalThreshold: 99 })
    );

    expect(budget.approvalThreshold).toBe(3);
  });

  test('removes the owner from the co-owner list and dedupes', async () => {
    const budget = await createSharedBudget(
      alice,
      baseInput({ coOwners: [bob, bob, alice] })
    );

    expect(budget.coOwners).toEqual([bob]);
    expect(budget.approvalThreshold).toBe(2);
  });

  test('rejects invalid co-owner addresses', async () => {
    await expect(
      createSharedBudget(alice, baseInput({ coOwners: ['bogus'] }))
    ).rejects.toThrow(/valid Stellar addresses/);
  });
});

describe('fetchSharedBudgets', () => {
  test('only returns budgets the wallet is a member of', async () => {
    await createSharedBudget(alice, baseInput());

    const aliceBudgets = await fetchSharedBudgets(alice);
    expect(aliceBudgets).toHaveLength(1);

    const bobBudgets = await fetchSharedBudgets(bob);
    expect(bobBudgets).toHaveLength(1);

    const malloryBudgets = await fetchSharedBudgets(mallory);
    expect(malloryBudgets).toHaveLength(0);
  });

  test('returns all shared budgets when no wallet is connected', async () => {
    await createSharedBudget(alice, baseInput());
    const all = await fetchSharedBudgets(null);
    expect(all).toHaveLength(1);
  });
});

describe('proposeBudgetChange', () => {
  test('auto-signs the proposer and keeps the change pending below threshold', async () => {
    const budget = await createSharedBudget(alice, baseInput());

    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    expect(change.status).toBe('pending');
    expect(change.approvals).toEqual([alice]);
    expect(change.description).toContain('750');

    // Budget amount unchanged before the threshold is reached.
    const stored = await fetchSharedBudgets(alice);
    expect(stored[0].amount).toBe(500);
  });

  test('applies immediately when the threshold is 1', async () => {
    const budget = await createSharedBudget(
      alice,
      baseInput({ approvalThreshold: 1 })
    );

    const change = await proposeBudgetChange(alice, budget.id, { amount: 900 });

    expect(change.status).toBe('approved');
    const stored = await fetchSharedBudgets(alice);
    expect(stored[0].amount).toBe(900);
  });

  test('throws when a non-member proposes a change', async () => {
    const budget = await createSharedBudget(alice, baseInput());

    await expect(
      proposeBudgetChange(mallory, budget.id, { amount: 999 })
    ).rejects.toThrow(/members/);
  });

  test('throws when the budget does not exist', async () => {
    await expect(
      proposeBudgetChange(alice, 'missing_budget', { amount: 999 })
    ).rejects.toThrow(/not found/);
  });
});

describe('approveBudgetChange', () => {
  test('applies the change only after the threshold is reached', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    // One approval (alice) is not enough for a 2-of-3 budget.
    expect(change.status).toBe('pending');

    const approved = await approveBudgetChange(bob, change.id);

    expect(approved.status).toBe('approved');
    const stored = await fetchSharedBudgets(alice);
    expect(stored[0].amount).toBe(750);
  });

  test('does not apply when the second approval has not happened yet', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    await proposeBudgetChange(alice, budget.id, { amount: 750 });

    const stored = await fetchSharedBudgets(alice);
    expect(stored[0].amount).toBe(500);
  });

  test('throws when a non-member tries to approve', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    await expect(approveBudgetChange(mallory, change.id)).rejects.toThrow(
      /members/
    );
  });

  test('does not double-count the same member approval', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    const again = await approveBudgetChange(alice, change.id);

    expect(again.approvals).toEqual([alice]);
    expect(again.status).toBe('pending');
  });
});

describe('rejectBudgetChange', () => {
  test('rejects a change once the threshold can no longer be reached', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    const afterBob = await rejectBudgetChange(bob, change.id);
    expect(afterBob.status).toBe('pending');

    const afterCarol = await rejectBudgetChange(carol, change.id);
    expect(afterCarol.status).toBe('rejected');

    // Budget unchanged after rejection.
    const stored = await fetchSharedBudgets(alice);
    expect(stored[0].amount).toBe(500);
  });

  test('a rejection does not prevent approval when the threshold is still reachable', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    await rejectBudgetChange(bob, change.id);
    const approved = await approveBudgetChange(carol, change.id);

    expect(approved.status).toBe('approved');
    const stored = await fetchSharedBudgets(alice);
    expect(stored[0].amount).toBe(750);
  });

  test('throws when a non-member tries to reject', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    const change = await proposeBudgetChange(alice, budget.id, { amount: 750 });

    await expect(rejectBudgetChange(mallory, change.id)).rejects.toThrow(
      /members/
    );
  });
});

describe('fetchPendingChanges', () => {
  test('only returns changes for budgets the wallet belongs to', async () => {
    const budget = await createSharedBudget(alice, baseInput());
    await proposeBudgetChange(alice, budget.id, { amount: 750 });

    const aliceChanges = await fetchPendingChanges(alice);
    expect(aliceChanges).toHaveLength(1);

    const malloryChanges = await fetchPendingChanges(mallory);
    expect(malloryChanges).toHaveLength(0);
  });
});

describe('isSharedBudgetMember', () => {
  test('recognizes owners and co-owners', async () => {
    const budget = await createSharedBudget(alice, baseInput());

    expect(isSharedBudgetMember(budget, alice)).toBe(true);
    expect(isSharedBudgetMember(budget, bob)).toBe(true);
    expect(isSharedBudgetMember(budget, mallory)).toBe(false);
  });
});

describe('describeBudgetChanges', () => {
  test('describes amount changes with the asset', async () => {
    const budget: SharedBudget = await createSharedBudget(alice, baseInput());
    const description = describeBudgetChanges(budget, { amount: 750 });

    expect(description).toBe('Amount: 500 → 750 USDC');
  });

  test('only includes fields that actually change', async () => {
    const budget: SharedBudget = await createSharedBudget(alice, baseInput());
    const description = describeBudgetChanges(budget, {
      name: 'Household',
      amount: 600,
    });

    expect(description).toContain('Amount');
    expect(description).not.toContain('Name');
  });
});

describe('subscribeToSharedBudgets', () => {
  test('fires on storage events and unsubscribes cleanly', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeToSharedBudgets(callback, {
      enablePolling: false,
    });

    window.dispatchEvent(
      new StorageEvent('storage', { key: SHARED_BUDGETS_KEY })
    );
    expect(callback).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new StorageEvent('storage', { key: PENDING_CHANGES_KEY })
    );
    expect(callback).toHaveBeenCalledTimes(2);

    // Unrelated storage keys do not trigger the callback.
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent('storage', { key: SHARED_BUDGETS_KEY })
    );
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('polls on an interval when enabled', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    const unsubscribe = subscribeToSharedBudgets(callback, {
      pollIntervalMs: 1000,
      enablePolling: true,
    });

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(4);

    unsubscribe();
    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(4);
  });
});
