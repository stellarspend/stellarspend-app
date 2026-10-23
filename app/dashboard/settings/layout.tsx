
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings | StellarSpend',
  description:
    'Manage your StellarSpend account, preferences, security, and application settings.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Settings | StellarSpend',
    description:
      'Manage your StellarSpend account, preferences, security, and application settings.',
    type: 'website',
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
