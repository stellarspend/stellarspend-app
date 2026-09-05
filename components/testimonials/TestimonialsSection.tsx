'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TestimonialCard from './TestimonialCard';

const testimonials = [
  {
    quote: 'StellarSpend helped me track my spending for the first time. No bank account needed, just my wallet.',
    author: 'Maria Santos',
    role: 'Small Business Owner',
    avatarSrc: '/images/avatars/maria.svg',
    region: 'Philippines',
    language: 'English',
  },
  {
    quote: 'The low transaction fees mean I can actually afford to manage my money. This is a game changer.',
    author: 'James Chen',
    role: 'Freelance Developer',
    avatarSrc: '/images/avatars/james.svg',
    region: 'Singapore',
    language: 'English',
  },
  {
    quote: 'Finally, a financial tool that respects my privacy and doesn\'t require endless paperwork.',
    author: 'Aisha Mohammed',
    role: 'Student',
    avatarSrc: '/images/avatars/aisha.svg',
    region: 'Kenya',
    language: 'Swahili',
  },
];

export default function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isMobile]);

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section
      className="relative w-full py-24 px-6"
      role="region"
      aria-label="Testimonials"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-white text-4xl md:text-5xl mb-4 tracking-tight">
            Trusted by <span className="text-[#e8b84b]">thousands</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
            See what our users are saying about their experience with StellarSpend.
          </p>
        </motion.div>

        {/* Mobile Carousel */}
        <div className="md:hidden relative">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <TestimonialCard
                  {...testimonials[currentIndex]}
                  index={currentIndex}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:border-[#e8b84b]/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84b]"
              aria-label="Previous testimonial"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Dots Indicator */}
            <div className="flex gap-2" role="tablist" aria-label="Testimonial navigation">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84b] ${
                    index === currentIndex
                      ? 'bg-[#e8b84b] w-8'
                      : 'bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : 'false'}
                  role="tab"
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:border-[#e8b84b]/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84b]"
              aria-label="Next testimonial"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Screen Reader Announcement */}
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            Showing testimonial {currentIndex + 1} of {testimonials.length}
          </div>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={testimonial.author} {...testimonial} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
