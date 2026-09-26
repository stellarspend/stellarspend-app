import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, test } from '@jest/globals';
import FeatureCard from '../FeatureCard';

// FeatureCard uses framer-motion's whileInView, which relies on
// IntersectionObserver — not available in jsdom.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  // @ts-expect-error IntersectionObserver is not part of the jsdom global type
  globalThis.IntersectionObserver = IntersectionObserverMock;
});

describe('FeatureCard', () => {
  const props = {
    title: 'Real-time Transaction Tracking',
    description: 'Monitor every Stellar transaction instantly with our blockchain-powered tracking system.',
    imageSrc: '/images/features/tracking.svg',
    imageAlt: 'Real-time transaction tracking dashboard',
    index: 0,
  };

  test('accepts and renders the title prop as a heading', () => {
    render(<FeatureCard {...props} />);

    expect(
      screen.getByRole('heading', { name: 'Real-time Transaction Tracking' })
    ).toBeInTheDocument();
  });

  test('renders the description and feature image', () => {
    render(<FeatureCard {...props} />);

    expect(
      screen.getByText(
        'Monitor every Stellar transaction instantly with our blockchain-powered tracking system.'
      )
    ).toBeInTheDocument();
    expect(screen.getByAltText('Real-time transaction tracking dashboard')).toBeInTheDocument();
  });

  test('renders a different title for each feature', () => {
    render(
      <FeatureCard
        {...props}
        title="Smart Budget Management"
        imageAlt="Budget management interface"
      />
    );

    expect(screen.getByRole('heading', { name: 'Smart Budget Management' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Real-time Transaction Tracking' })).not.toBeInTheDocument();
  });

  test('renders the feature icon inside its container', () => {
    render(<FeatureCard {...props} />);

    // The feature icon (illustration) is rendered.
    const icon = screen.getByAltText('Real-time transaction tracking dashboard');
    expect(icon).toBeInTheDocument();

    // The icon lives inside a dedicated container element.
    const iconContainer = icon.parentElement;
    expect(iconContainer).not.toBeNull();
    expect(iconContainer).toBeInTheDocument();
  });
  test('renders title and description props in the DOM', () => {
    render(
      <FeatureCard
        title="Instant Cross-Border Payments"
        description="Send XLM anywhere in the world within seconds at near-zero fees."
        imageSrc="/images/features/payments.svg"
        imageAlt="Cross-border payments illustration"
        index={1}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Instant Cross-Border Payments' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Send XLM anywhere in the world within seconds at near-zero fees.')
    ).toBeInTheDocument();
  });

});
