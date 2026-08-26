import type { Metadata } from "next";
import Hero from "@/components/hero/Hero";
import FeaturesSection from "@/components/features/FeaturesSection";
import TestimonialsSection from "@/components/testimonials/TestimonialsSection";
import Carousel from "@/components/carousel/Carousel";
import PricingCards from "@/components/pricing/PricingCards";
import type { CarouselSlide } from "@/components/carousel/Carousel";

const HOME_DESCRIPTION =
  "StellarSpend is a financial management platform for the unbanked and underbanked, built on the Stellar blockchain. Track spending, set budgets, and reach your savings goals.";

export const metadata: Metadata = {
  title: "StellarSpend — Track your Stellar transactions",
  description: HOME_DESCRIPTION,
  openGraph: {
    title: "StellarSpend",
    description: HOME_DESCRIPTION,
    url: "https://stellarspend.app",
    siteName: "StellarSpend",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StellarSpend — Track your Stellar transactions",
    description: HOME_DESCRIPTION,
  },
};

const FEATURE_SLIDES: CarouselSlide[] = [
  {
    id: "tracking",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-4 4 4 4-4" />
      </svg>
    ),
    title: "Transaction Tracking",
    description:
      "Monitor every payment on the Stellar blockchain in real-time. Full history, zero surprises.",
    stat: "< 5s",
    statLabel: "Settlement time",
  },
  {
    id: "budgets",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-4 0v2" />
        <circle cx="12" cy="14" r="2" />
      </svg>
    ),
    title: "Smart Budgets",
    description:
      "Set monthly spending limits by category. Get notified before you go over — not after.",
    stat: "3×",
    statLabel: "Better savings rate",
  },
  {
    id: "savings",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    title: "Savings Goals",
    description:
      "Define a target, pick a date, and watch your progress. Automated round-ups make it effortless.",
    stat: "$0",
    statLabel: "Minimum balance",
  },
];

export default function HomePage() {
  return (
    <main>
      <Hero />

      <section
        id="features"
        aria-label="Feature highlights"
        className="py-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">
            Everything you need
          </h2>
          <p className="text-center text-slate-400 mb-10 text-sm max-w-md mx-auto">
            Built on Stellar so fees stay near zero and settlements finish in
            seconds.
          </p>
          <Carousel slides={FEATURE_SLIDES} autoAdvanceMs={4500} />
        </div>
      </section>

      <FeaturesSection />
      <PricingCards />
      <TestimonialsSection />
    </main>
  );
}
