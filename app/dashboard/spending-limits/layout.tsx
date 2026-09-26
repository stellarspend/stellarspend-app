import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spending Limits | StellarSpend',
};

export default function SpendingLimitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
