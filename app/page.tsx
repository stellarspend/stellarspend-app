import type { Metadata } from 'next';
import Hero from '@/components/hero/Hero';
import FeaturesSection from '@/components/features/FeaturesSection';
import TestimonialsSection from '@/components/testimonials/TestimonialsSection';
import Testimonial from '@/components/testimonial/Testimonial';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Grid } from '@/components/ui/Grid';

export const metadata: Metadata = {
  title: 'StellarSpend — Track your Stellar transactions',
  description:
    'StellarSpend is a financial management platform for the unbanked and underbanked, built on the Stellar blockchain. Track spending, set budgets, and reach your savings goals.',
  openGraph: {
    title: 'StellarSpend',
    description: 'Blockchain-powered budgeting for everyone.',
    url: 'https://stellarspend.app',
    siteName: 'StellarSpend',
  },
};

export default function HomePage() {
  return (
    <main id="main-content">
      <Hero />
      <FeaturesSection />
      <TestimonialsSection />
      <Testimonial />

      <section id="features" aria-label="Features overview" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
          <Grid cols={1} gap="lg" responsive={{ sm: 2, lg: 3 }}>
            <Card variant="elevated">
              <CardHeader>
                <h3 className="text-xl font-semibold">Track Spending</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600">Monitor your transactions on the Stellar blockchain in real-time.</p>
              </CardBody>
            </Card>
            
            <Card variant="elevated">
              <CardHeader>
                <h3 className="text-xl font-semibold">Set Budgets</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600">Create and manage budgets to stay on top of your finances.</p>
              </CardBody>
            </Card>
            
            <Card variant="elevated">
              <CardHeader>
                <h3 className="text-xl font-semibold">Savings Goals</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600">Set targets and track progress toward your financial goals.</p>
              </CardBody>
            </Card>
          </Grid>
        </div>
      </section>
    </main>
  );
}