import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';

// The dashboard pulls in a lot of unrelated widgets (balances, quick
// actions, recent transactions, split bills) — none of which matter for
// these tests, so they're stubbed out to keep this focused on savings
// goal behavior.
jest.mock('@/components/dashboard/BalancesWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="balances-widget" />,
}));
jest.mock('@/components/dashboard/QuickActions', () => ({
  __esModule: true,
  default: () => <div data-testid="quick-actions" />,
}));
jest.mock('@/components/dashboard/RecentTransactions', () => ({
  __esModule: true,
  default: () => <div data-testid="recent-transactions" />,
}));
jest.mock('@/components/payments/SplitBillModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/payments/PendingSplitCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/lib/stellar/escrowContract', () => ({
  fetchSplitsForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/hooks/useWallet', () => ({
  __esModule: true,
  // No connected wallet -> the dashboard should exercise the local/mock
  // fallback paths this issue fixes.
  default: () => ({ freighter: { publicKey: null } }),
}));

jest.mock('@/components/offline/OfflineProvider', () => ({
  useOffline: () => ({ isOnline: true, queueAction: jest.fn() }),
}));

const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import DashboardPage from '../page';
import {
  getMockGoalsFallback,
  setMockGoalsFallback,
} from '@/lib/stellar/savingsGoalContract';
import { PAYMENT_CONFIRMED_EVENT } from '@/lib/stellar/submitTransaction';

function seedGoal() {
  setMockGoalsFallback([
    {
      id: 'goal_1',
      name: 'New Laptop',
      targetAmount: 1000,
      currentAmount: 100,
      deadline: '2099-01-01',
      recurrence: 'once',
      createdAt: new Date(),
      roundUpRule: { enabled: true, nearestUnit: 1, paused: false },
    },
  ]);
}

describe('DashboardPage savings goal automation (issue #113)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockClear();
  });

  test('applies a round-up contribution to the goal balance when a payment is confirmed', async () => {
    seedGoal();
    render(<DashboardPage />);

    // Let the goal-loading effect settle.
    await screen.findByText('New Laptop');

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PAYMENT_CONFIRMED_EVENT, {
          detail: { amount: '4.30', hash: 'txhash123' },
        }),
      );
    });

    // 4.30 rounded up to the nearest 1 XLM is 5.00, so 0.70 should be
    // added: 100 + 0.70 = 100.70.
    expect(await screen.findByText(/\$100\.70/)).toBeInTheDocument();
  });

  test('does not touch the goal balance when round-up is paused', async () => {
    setMockGoalsFallback([
      {
        id: 'goal_1',
        name: 'New Laptop',
        targetAmount: 1000,
        currentAmount: 100,
        deadline: '2099-01-01',
        recurrence: 'once',
        createdAt: new Date(),
        roundUpRule: { enabled: true, nearestUnit: 1, paused: true },
      },
    ]);
    render(<DashboardPage />);
    await screen.findByText('New Laptop');

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PAYMENT_CONFIRMED_EVENT, {
          detail: { amount: '4.30', hash: 'txhash456' },
        }),
      );
    });

    // Give any (incorrect) async update a chance to land before asserting
    // it didn't.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
  });

  test('the "Check Due Contributions" trigger executes a due monthly schedule', async () => {
    setMockGoalsFallback([
      {
        id: 'goal_1',
        name: 'Emergency Fund',
        targetAmount: 2000,
        currentAmount: 100,
        deadline: '2099-01-01',
        recurrence: 'monthly',
        createdAt: new Date(),
        schedule: {
          nextDueDate: new Date(Date.now() - 1000).toISOString(),
          amount: 50,
          paused: false,
        },
      },
    ]);
    render(<DashboardPage />);
    await screen.findByText('Emergency Fund');

    const button = await screen.findByRole('button', { name: /check due contributions/i });
    fireEvent.click(button);

    expect(await screen.findByText(/\$150\.00/)).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Contributions Executed' }),
    );

    // The mock goal store should reflect the executed contribution too,
    // not just in-memory component state.
    const [stored] = getMockGoalsFallback();
    expect(stored.currentAmount).toBe(150);
  });

  test('the due-contributions button is not shown when no goal has an active schedule', async () => {
    seedGoal(); // round-up only, no schedule
    render(<DashboardPage />);
    await screen.findByText('New Laptop');

    expect(screen.queryByRole('button', { name: /check due contributions/i })).not.toBeInTheDocument();
  });
});
