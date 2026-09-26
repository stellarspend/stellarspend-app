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

  it('applies the correct gap class for a spacing value', () => {
    const { container } = render(
      <Stack spacing="lg" aria-label="Spaced stack">
        <span>Item</span>
      </Stack>
    );

    expect(container.firstChild).toHaveClass('gap-6');
  });
});
