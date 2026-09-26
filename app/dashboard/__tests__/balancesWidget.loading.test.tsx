import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';

// The widget talks to Horizon and opens an SSE stream on mount; both are
// stubbed so the skeleton assertions are deterministic and fully offline.
jest.mock('@/lib/api/client', () => ({
  fetchBalances: jest.fn(),
}));

jest.mock('@/lib/stellar/accountStream', () => ({
  startAccountStream: jest.fn(),
  subscribeAccountStream: jest.fn(() => jest.fn()),
  subscribeAccountStreamStatus: jest.fn(() => jest.fn()),
}));

import BalancesWidget from '@/components/dashboard/BalancesWidget';
import { fetchBalances, type WalletBalances } from '@/lib/api/client';

const mockFetchBalances = fetchBalances as jest.MockedFunction<typeof fetchBalances>;

const BALANCES: WalletBalances = {
  balances: [
    { asset: 'XLM', balance: '4 210.50', usdValue: 631.58, change24h: 2.4 },
    { asset: 'USDC', balance: '1 085.20', usdValue: 1085.2, change24h: 0.01 },
    { asset: 'EURC', balance: '320.00', usdValue: 347.2, change24h: -0.31 },
  ],
  totalUsd: 2063.98,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  mockFetchBalances.mockReset();
});

describe('BalancesWidget loading skeleton contract (issue #46)', () => {
  test('renders three placeholders and no asset cards while the balance fetch is in flight', async () => {
    let resolveBalances: (value: WalletBalances) => void = () => {};
    mockFetchBalances.mockReturnValue(
      new Promise<WalletBalances>((resolve) => {
        resolveBalances = resolve;
      })
    );

    render(<BalancesWidget />);

    expect(screen.getAllByTestId('balance-skeleton')).toHaveLength(3);
    expect(screen.getByTestId('balances-total-skeleton')).toBeInTheDocument();
    expect(screen.queryAllByTestId('balance-card')).toHaveLength(0);
    expect(screen.getByTestId('balances-grid')).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      resolveBalances(BALANCES);
    });

    await waitFor(() =>
      expect(screen.queryAllByTestId('balance-skeleton')).toHaveLength(0)
    );

    expect(screen.queryByTestId('balances-total-skeleton')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('balance-card')).toHaveLength(3);
    expect(screen.getByTestId('balances-grid')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Total Portfolio')).toBeInTheDocument();
  });

  test('keeps the placeholders — never an empty widget — when the initial fetch fails', async () => {
    mockFetchBalances.mockRejectedValue(new Error('horizon unavailable'));

    render(<BalancesWidget />);

    await waitFor(() =>
      expect(screen.getAllByTestId('balance-skeleton')).toHaveLength(3)
    );
    expect(screen.getByTestId('balances-total-skeleton')).toBeInTheDocument();
    expect(screen.queryAllByTestId('balance-card')).toHaveLength(0);
    expect(screen.getByTestId('balances-grid')).toHaveAttribute('aria-busy', 'true');
  });

  test('a failed manual refresh keeps the balances already on screen', async () => {
    mockFetchBalances.mockResolvedValueOnce(BALANCES);
    render(<BalancesWidget />);

    await waitFor(() =>
      expect(screen.getAllByTestId('balance-card')).toHaveLength(3)
    );

    mockFetchBalances.mockRejectedValueOnce(new Error('horizon unavailable'));
    await act(async () => {
      screen.getByRole('button', { name: /refresh balances/i }).click();
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('balance-card')).toHaveLength(3)
    );
    expect(screen.queryAllByTestId('balance-skeleton')).toHaveLength(0);
    expect(screen.getByText('Total Portfolio')).toBeInTheDocument();
  });
});
