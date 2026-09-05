import { render, screen } from '@testing-library/react';
import { Stack } from '../Stack';

describe('Stack', () => {
  it('applies an aria-label to its container', () => {
    render(
      <Stack aria-label="Transaction list">
        <span>Transaction</span>
      </Stack>
    );

    expect(screen.getByLabelText('Transaction list')).toBeInTheDocument();
  });
});