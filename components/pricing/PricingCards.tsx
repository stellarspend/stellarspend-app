import Link from "next/link";
import "@/styles/pricing.css";

const STEPS = [
  {
    number: "01",
    title: "Connect your wallet",
    description:
      "Link your Stellar wallet in seconds. No bank account, no paperwork.",
    icon: (
      <svg
        width="22"
        height="22"
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
  },
  {
    number: "02",
    title: "Track your spending",
    description:
      "Every transaction on Stellar appears instantly. Categorised automatically.",
    icon: (
      <svg
        width="22"
        height="22"
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
  },
  {
    number: "03",
    title: "Reach your goals",
    description:
      "Set savings targets, automate round-ups, and build financial security.",
    icon: (
      <svg
        width="22"
        height="22"
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
  },
];

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    priceNote: "forever",
    description: "Everything you need to get started.",
    features: [
      "1 connected wallet",
      "Transaction history (30 days)",
      "3 budget categories",
      "1 savings goal",
      "Community support",
    ],
    cta: "Get started",
    ctaHref: "/onboarding",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$4",
    priceNote: "/ month",
    description: "For users serious about their finances.",
    features: [
      "Up to 5 wallets",
      "Full transaction history",
      "Unlimited budgets",
      "Unlimited savings goals",
      "Email alerts & reports",
      "Priority support",
    ],
    cta: "Start free trial",
    ctaHref: "/onboarding?plan=growth",
    highlight: true,
  },
  {
    name: "Family",
    price: "$9",
    priceNote: "/ month",
    description: "Shared finances for households.",
    features: [
      "Up to 10 wallets",
      "Shared budget views",
      "Per-member spending limits",
      "Savings goal collaboration",
      "Dedicated support",
    ],
    cta: "Start free trial",
    ctaHref: "/onboarding?plan=family",
    highlight: false,
  },
];

export default function PricingCards() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="pricing-section"
    >
      <div className="pricing-inner">
        {/* How it works */}
        <div className="pricing-how">
          <h2 id="pricing-heading" className="pricing-heading">
            How it works
          </h2>
          <p className="pricing-subheading">
            From zero to financially empowered in three steps.
          </p>

          <ol className="pricing-steps" aria-label="How StellarSpend works">
            {STEPS.map((step, i) => (
              <li key={step.number} className="pricing-step">
                {i < STEPS.length - 1 && (
                  <span
                    className="pricing-step__connector"
                    aria-hidden="true"
                  />
                )}
                <div className="pricing-step__icon" aria-hidden="true">
                  {step.icon}
                </div>
                <span className="pricing-step__number" aria-hidden="true">
                  {step.number}
                </span>
                <h3 className="pricing-step__title">{step.title}</h3>
                <p className="pricing-step__desc">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Tier cards */}
        <div className="pricing-tiers" role="list" aria-label="Pricing tiers">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`pricing-card${tier.highlight ? " pricing-card--highlight" : ""}`}
              role="listitem"
              aria-label={`${tier.name} plan`}
            >
              {tier.highlight && (
                <span
                  className="pricing-card__badge"
                  aria-label="Most popular plan"
                >
                  Most popular
                </span>
              )}

              <div className="pricing-card__header">
                <h3 className="pricing-card__name">{tier.name}</h3>
                <div className="pricing-card__price">
                  <span className="pricing-card__amount">{tier.price}</span>
                  <span className="pricing-card__note">{tier.priceNote}</span>
                </div>
                <p className="pricing-card__desc">{tier.description}</p>
              </div>

              <ul
                className="pricing-card__features"
                aria-label={`${tier.name} plan features`}
              >
                {tier.features.map((f) => (
                  <li key={f} className="pricing-card__feature">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`pricing-card__cta${tier.highlight ? " pricing-card__cta--primary" : ""}`}
                aria-label={`${tier.cta} with ${tier.name} plan`}
              >
                {tier.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
