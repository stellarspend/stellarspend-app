// Note: `jest` is used as a global (not imported from @jest/globals) because
// importing it disables jest.mock hoisting in this repo's SWC transform.
import { describe, expect, test } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

// @stellar/stellar-sdk ships ESM-only deps (e.g. @noble/hashes) that jest
// cannot parse, so we mock the small surface used for test fixtures.
jest.mock('@stellar/stellar-sdk', () => {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let seq = 0;
  return {
    Keypair: {
      random: () => ({
        publicKey: () =>
          'G' + Array.from({ length: 55 }, (_, i) => ALPHABET[(i + seq++) % 32]).join(''),
      }),
    },
  };
});

import { Keypair } from '@stellar/stellar-sdk';
import PendingApprovalCard from '../PendingApprovalCard';
import type { PendingBudgetChange, SharedBudget } from '@/lib/api/client';

const alice = Keypair.random().publicKey();
const bob = Keypair.random().publicKey();

function makeBudget(overrides: Partial<SharedBudget> = {}): SharedBudget {
  return {
    id: 'shared_budget_1',
    name: 'Household',
    amount: 500,
    category: 'housing',
    asset: 'USDC',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ownerAddress: alice,
    coOwners: [bob],
    approvalThreshold: 2,
    isShared: true,
    ...overrides,
  };
}

function makeChange(overrides: Partial<PendingBudgetChange> = {}): PendingBudgetChange {
  return {
    id: 'change_1',
    budgetId: 'shared_budget_1',
    budgetName: 'Household',
    type: 'update',
    description: 'Amount: 500 → 750 USDC',
    proposedBy: alice,
    proposedAt: '2026-08-01T12:00:00.000Z',
    changes: { amount: 750 },
    approvals: [alice],
    rejections: [],
    status: 'pending',
    ...overrides,
  };
}

describe('PendingApprovalCard', () => {
  test('shows the proposed change and approval progress', () => {
    render(
      <PendingApprovalCard
        change={makeChange()}
        budget={makeBudget()}
        currentUser={bob}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByText(/Proposed change/)).toBeTruthy();
    expect(screen.getByText('Amount: 500 → 750 USDC')).toBeTruthy();
    expect(screen.getByText('1/2 needed')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
  });

  test('calls onApprove with the change id', () => {
    const onApprove = jest.fn();
    render(
      <PendingApprovalCard
        change={makeChange()}
        budget={makeBudget()}
        currentUser={bob}
        onApprove={onApprove}
        onReject={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith('change_1');
  });

  test('calls onReject with the change id', () => {
    const onReject = jest.fn();
    render(
      <PendingApprovalCard
        change={makeChange()}
        budget={makeBudget()}
        currentUser={bob}
        onApprove={jest.fn()}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith('change_1');
  });

  test('disables actions once the current user has already signed', () => {
    render(
      <PendingApprovalCard
        change={makeChange()}
        budget={makeBudget()}
        currentUser={alice}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled();
  });

  test('disables actions for users who are not budget members', () => {
    render(
      <PendingApprovalCard
        change={makeChange()}
        budget={makeBudget()}
        currentUser={Keypair.random().publicKey()}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
    expect(screen.getByText(/Only members of this shared budget/)).toBeTruthy();
  });

  test('shows an approved state without action buttons once resolved', () => {
    render(
      <PendingApprovalCard
        change={makeChange({
          status: 'approved',
          approvals: [alice, bob],
          resolvedAt: '2026-08-01T12:05:00.000Z',
        })}
        budget={makeBudget()}
        currentUser={bob}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByText('Approved & applied')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  test('shows a rejected state once resolved', () => {
    render(
      <PendingApprovalCard
        change={makeChange({
          status: 'rejected',
          approvals: [alice],
          rejections: [bob],
          resolvedAt: '2026-08-01T12:05:00.000Z',
        })}
        budget={makeBudget()}
        currentUser={bob}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
  });
});
