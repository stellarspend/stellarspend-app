import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Budgets | StellarSpend',
};

export default function BudgetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
