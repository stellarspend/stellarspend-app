'use client';

import { motion } from 'framer-motion';
import FeatureCard from './FeatureCard';

const features = [
  {
    title: 'Real-time Transaction Tracking',
    description: 'Monitor every Stellar transaction instantly with our blockchain-powered tracking system.',
    imageSrc: '/images/features/tracking.svg',
    imageAlt: 'Real-time transaction tracking dashboard',
  },
  {
    title: 'Smart Budget Management',
    description: 'Set intelligent budgets that adapt to your spending patterns and help you save more.',
    imageSrc: '/images/features/budgets.svg',
    imageAlt: 'Budget management interface',
  },
  {
    title: 'Savings Goals',
    description: 'Create and track savings goals with visual progress indicators and milestone celebrations.',
    imageSrc: '/images/features/savings.svg',
    imageAlt: 'Savings goals visualization',
  },
];

export default function FeaturesSection() {
  return (
    <section
      role="region"
      className="relative w-full py-24 px-6 overflow-hidden"
      aria-label="Features"
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-[#e8b84b]/5 to-transparent pointer-events-none"
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-white text-4xl md:text-5xl mb-4 tracking-tight">
            Built for <span className="text-[#e8b84b]">everyone</span>
          </h2>
          <p className="text-[#7a8aaa] text-lg max-w-2xl mx-auto">
            Powerful financial tools designed for the unbanked and underbanked,
            powered by the Stellar blockchain.
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
