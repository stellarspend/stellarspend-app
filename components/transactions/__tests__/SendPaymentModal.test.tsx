import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import SendPaymentModal from '../SendPaymentModal';
import { NotificationProvider } from '@/context/NotificationContext';
import { OfflineProvider } from '@/components/offline/OfflineProvider';
import { WalletProvider } from '@/context/WalletContext';

jest.mock('@/lib/zk/generateSpendingProof', () => ({
  generateSpendingProof: jest.fn(),
}));

jest.mock('@/hooks/useWallet', () => ({
  __esModule: true,
  default: () => ({
    freighter: {
      isInstalled: true,
      isConnected: true,
      publicKey: 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO',
      isConnecting: false,
      freighterError: null,
    },
    sendPayment: jest.fn(),
  }),
}));

describe('SendPaymentModal spending limit checks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('blocks sending and displays error when amount exceeds remaining spending limit', async () => {
    // Set a weekly limit of 100 USDC with 60 spent (40 remaining)
    localStorage.setItem(
      'stellarspend_local_spending_limits',
      JSON.stringify([
        {
          id: 'test_usdc',
          publicKey: 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO',
          asset: 'USDC',
          limitAmount: 100,
          spentAmount: 60,
          period: 'weekly',
          periodStart: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    );

    render(
      <WalletProvider>
        <NotificationProvider>
          <OfflineProvider>
            <SendPaymentModal onClose={jest.fn()} />
          </OfflineProvider>
        </NotificationProvider>
      </WalletProvider>
    );

    // Enter recipient (exact 56 chars starting with G)
    const validRecipient = 'G' + 'A'.repeat(55);
    const recipientInput = screen.getByPlaceholderText('G...');
    fireEvent.change(recipientInput, {
      target: { value: validRecipient },
    });

    // Enter amount 200 (exceeds 40 USDC remaining)
    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: 'USDC' } });

    // Click Send Payment
    const sendButton = screen.getByRole('button', { name: /Sign and Send Payment/i });
    fireEvent.click(sendButton);

    // Verify error message is shown and ZK proof is blocked
    await waitFor(() => {
      expect(
        screen.getByText('Weekly USDC limit reached — 40 USDC remaining')
      ).toBeInTheDocument();
    });
  });
});
