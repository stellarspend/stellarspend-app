"use client";

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationsCenter } from '@/components/notifications/NotificationsCenter';

import { Starfield } from "@/components/ui/Starfield";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

/**
 * Full-viewport marketing hero section for the landing page.
 *
 * Composes the starfield background, animated headline and subtext, the
 * primary/secondary CTAs, a simulated-error notification trigger, the
 * platform stats strip and the floating notification centre
 * ({@link NotificationsCenter}).
 *
 * @returns The hero `<section>` element rendered at the top of the home page.
 */
export default function Hero() {
  const { addNotification } = useNotifications();
  return (
    <section
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden px-6 py-24"
      aria-label="StellarSpend hero section"
    >
      <div className="absolute top-6 right-6 z-50">
        <NotificationsCenter />
      </div>
      <Starfield />

      {/* Glow orbs — fixed pixel sizes, truly absolute so they don't affect layout */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-80px",
          right: "-80px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,184,75,0.13) 0%, transparent 70%)",
          filter: "blur(100px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-60px",
          left: "-100px",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(74,169,232,0.11) 0%, transparent 70%)",
          filter: "blur(100px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Main content — centered column */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center w-full max-w-2xl mx-auto"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span
            className="inline-flex items-center gap-2 pl-2 pr-4 py-1 mb-8 rounded-full text-[#e8b84b] text-xs font-medium tracking-widest uppercase border border-[#e8b84b]/20 bg-[#e8b84b]/[0.08]"
            aria-label="Built on Stellar blockchain"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#e8b84b] animate-pulse"
              aria-hidden="true"
            />
            Built on Stellar
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="font-display text-white mb-6 leading-[1.1] tracking-tight"
          style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)" }}
          variants={fadeUp}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          Take{" "}
          <em className="not-italic italic text-[#e8b84b]">full control</em> of
          your money
        </motion.h1>

        {/* Subtext */}
        <motion.p
          className="font-body font-light text-[#7a8aaa] max-w-lg mx-auto mb-10 leading-relaxed"
          style={{ fontSize: "clamp(1rem, 2vw, 1.125rem)" }}
          variants={fadeUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          StellarSpend tracks every transaction on the Stellar blockchain
          budgeting, analytics, and savings goals built for the people who need
          them most.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3 mb-4 w-full p-0.5"
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Primary — navigates to /sign-in */}
          <a
            href="/sign-in"
            aria-label="Get started"
            className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full font-semibold text-base transition-all duration-200
                       bg-[#e8b84b] text-[#1a0f00]
                       hover:bg-[#f0c85a] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(232,184,75,0.35)]
                       active:translate-y-0
                       focus-visible:outline focus-visible:outline-[#e8b84b] focus-visible:outline-offset-2"
          >
            Get started
            <ArrowRight size={18} aria-hidden="true" />
          </a>

          {/* Docs link — navigates to /docs */}
          <a
            href="/docs"
            className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full font-medium text-base transition-all duration-200
                       border border-white/20 text-white/70
                       hover:border-white/40 hover:text-white hover:-translate-y-0.5
                       active:translate-y-0"
          >
            Read the docs
          </a>

          {/* Secondary — fires error notification simulation */}
          <button
            onClick={() =>
              addNotification(
                "error",
                "Simulation: Transaction failed due to insufficient XLM.",
              )
            }
            className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full font-medium text-base transition-all duration-200
                       border border-red-500/30 text-red-400 bg-red-500/5
                       hover:border-red-500/50 hover:bg-red-500/10 hover:-translate-y-0.5
                       active:translate-y-0"
          >
            Simulate Error
          </button>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="w-full max-w-sm h-px bg-linear-to-r from-transparent via-white/10 to-transparent mb-12"
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          aria-hidden="true"
        />

        {/* Stats strip */}
        <motion.div
          className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6 w-full"
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          aria-label="Platform highlights"
        >
          <div className="flex flex-col items-center gap-1">
            <p
              className="font-display text-white leading-none"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
            >
              0.01¢
            </p>
            <p className="text-[#7a8aaa] text-[0.68rem] tracking-widest uppercase">
              per transaction
            </p>
          </div>

          <div
            className="hidden sm:block w-px h-8 bg-white/10"
            aria-hidden="true"
          />

          <div className="flex flex-col items-center gap-1">
            <p
              className="font-display text-white leading-none"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
            >
              9
            </p>
            <p className="text-[#7a8aaa] text-[0.68rem] tracking-widest uppercase">
              languages
            </p>
          </div>

          <div
            className="hidden sm:block w-px h-8 bg-white/10"
            aria-hidden="true"
          />

          <div className="flex flex-col items-center gap-1">
            <p
              className="font-display text-white leading-none"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
            >
              No KYC
            </p>
            <p className="text-[#7a8aaa] text-[0.68rem] tracking-widest uppercase">
              wallet = identity
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#7a8aaa] text-[0.65rem] tracking-[0.12em] uppercase"
        aria-hidden="true"
      >
        <span>scroll</span>
        <span className="block w-px h-8 bg-linear-to-b from-[#7a8aaa] to-transparent" />
      </div>
    </section>
  );
}
