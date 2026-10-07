import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import BudgetForm from '../BudgetForm';

// Mock @stellar/stellar-sdk if needed
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    random: () => ({
      publicKey: () => 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    }),
  },
  StrKey: {
    isValidEd25519PublicKey: () => true,
  },
}));

describe('BudgetForm', () => {
  it('renders dynamic asset label and cross-asset conversion preview for initialData', () => {
    const initialData = {
      id: 'b1',
      name: 'Groceries',
      amount: 100,
      category: 'food',
      asset: 'XLM' as const,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    render(<BudgetForm onSubmit={jest.fn()} initialData={initialData} isEditing={true} />);

    // Check dynamic asset label
    expect(screen.getByText(/Amount \(XLM\)/i)).toBeTruthy();

    // Check cross-asset conversion preview
    const preview = screen.getByTestId('cross-asset-conversion-preview');
    expect(preview).toBeTruthy();
    // 100 XLM @ 0.15 = $15.00 USD
    expect(preview.textContent).toContain('$15.00 USD');
    // 100 XLM = 15.00 USDC
    expect(preview.textContent).toContain('15.00 USDC');
  });

  it('renders USDC cross-asset conversion preview properly', () => {
    const initialData = {
      id: 'b2',
      name: 'Cloud Services',
      amount: 50,
      category: 'utilities',
      asset: 'USDC' as const,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    render(<BudgetForm onSubmit={jest.fn()} initialData={initialData} isEditing={true} />);

    expect(screen.getByText(/Amount \(USDC\)/i)).toBeTruthy();
    const preview = screen.getByTestId('cross-asset-conversion-preview');
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain('$50.00 USD');
  });
});
