import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, jest } from '@jest/globals';
import SpendingLimitCard from '../SpendingLimitCard';
import type { SpendingLimit } from '@/lib/stellar/spendingLimitsContract';

describe('SpendingLimitCard', () => {
  const mockLimit: SpendingLimit = {
    id: 'limit_1',
    publicKey: 'GTEST123',
    asset: 'USDC',
    limitAmount: 100,
    spentAmount: 80,
    period: 'weekly',
    periodStart: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test('renders spending limit details correctly', () => {
    render(<SpendingLimitCard limit={mockLimit} onDelete={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'USDC' })).toBeInTheDocument();
    expect(screen.getByText('weekly')).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
    expect(screen.getByText(/80 \/ 100 USDC/)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  test('shows delete confirmation prompt on delete click and handles deletion', async () => {
    const onDelete = jest.fn();
    render(<SpendingLimitCard limit={mockLimit} onDelete={onDelete} />);

    const deleteBtn = screen.getByRole('button', { name: /Delete USDC limit/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/Delete this limit\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(onDelete).toHaveBeenCalledWith('limit_1');
  });
});
