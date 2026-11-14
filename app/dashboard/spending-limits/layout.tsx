
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spending Limits | StellarSpend',
  description:
    'Manage and configure your StellarSpend spending limits and transaction controls.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Spending Limits | StellarSpend',
    description:
      'Manage and configure your StellarSpend spending limits and transaction controls.',
    type: 'website',
  },
};

export default function SpendingLimitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
