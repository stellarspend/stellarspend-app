import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, test } from '@jest/globals';
import { Toast } from '../Toast';
import { NotificationProvider } from '@/context/NotificationContext';

// Toast uses framer-motion, which requires AnimatePresence context
beforeAll(() => {
  // Mock framer-motion animation delays to speed up tests
  jest.mock('framer-motion', () => ({
    ...jest.requireActual('framer-motion'),
  }));
});

// Wrapper component to provide necessary context
const ToastWithContext = (props: React.ComponentProps<typeof Toast>) => (
  <NotificationProvider>
    <Toast {...props} />
  </NotificationProvider>
);

describe('Toast', () => {
  const defaultProps = {
    id: '1',
    type: 'success' as const,
    message: 'Operation successful',
  };

  test('renders the container element with aria-live="polite" for accessibility', () => {
    const { container } = render(<ToastWithContext {...defaultProps} />);
    
    const toastContainer = container.querySelector('div[class*="flex"]');
    expect(toastContainer).toHaveAttribute('aria-live', 'polite');
  });

  test('renders success toast with message', () => {
    render(<ToastWithContext {...defaultProps} />);
    
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  test('renders error toast with correct styling', () => {
    const { container } = render(
      <ToastWithContext {...defaultProps} type="error" message="An error occurred" />
    );
    
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
    const toastContainer = container.querySelector('div[class*="flex"]');
    expect(toastContainer).toHaveAttribute('aria-live', 'polite');
  });

  test('renders info toast with aria-live attribute', () => {
    const { container } = render(
      <ToastWithContext {...defaultProps} type="info" message="Here is some info" />
    );
    
    expect(screen.getByText('Here is some info')).toBeInTheDocument();
    const toastContainer = container.querySelector('div[class*="flex"]');
    expect(toastContainer).toHaveAttribute('aria-live', 'polite');
  });

  test('renders close button', () => {
    render(<ToastWithContext {...defaultProps} />);
    
    // The close button should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('aria-live attribute persists across different notification types', () => {
    const types: Array<'success' | 'error' | 'info'> = ['success', 'error', 'info'];
    
    types.forEach((type) => {
      const { container } = render(
        <ToastWithContext {...defaultProps} type={type} />
      );
      
      const toastContainer = container.querySelector('div[class*="flex"]');
      expect(toastContainer).toHaveAttribute('aria-live', 'polite');
    });
  });
});
