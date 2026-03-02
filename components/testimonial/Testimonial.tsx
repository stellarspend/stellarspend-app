'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import '../styles/testimonial.css';

interface TestimonialData {
  name: string;
  role: string;
  quote: string;
  avatar: string;
  region: string;
  language: string;
}

const testimonials: TestimonialData[] = [
  {
    name: "Amara Okafor",
    role: "Small Business Owner",
    quote: "StellarSpend helped me track my shop expenses without needing a bank account. It's simple and works offline.",
    avatar: "/avatars/amara.jpg",
    region: "Lagos, Nigeria",
    language: "English"
  },
  {
    name: "Carlos Mendez",
    role: "Freelance Driver",
    quote: "I can finally see where my money goes each month. The budget alerts keep me on track.",
    avatar: "/avatars/carlos.jpg",
    region: "Mexico City, Mexico",
    language: "Spanish"
  },
  {
    name: "Fatima Hassan",
    role: "Market Vendor",
    quote: "No paperwork, no fees. Just my wallet and my phone. This is financial freedom.",
    avatar: "/avatars/fatima.jpg",
    region: "Nairobi, Kenya",
    language: "Swahili"
  }
];

export default function Testimonial() {
  const [current, setCurrent] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isMobile]);

  return (
    <section className="testimonial-section">
      <h2>Trusted by Communities Worldwide</h2>
      
      {isMobile ? (
        <div className="testimonial-carousel">
          <div className="testimonial-card">
            <Image
              src={testimonials[current].avatar}
              alt={`${testimonials[current].name} avatar`}
              width={64}
              height={64}
              loading="lazy"
              className="testimonial-avatar"
            />
            <blockquote>{testimonials[current].quote}</blockquote>
            <div className="testimonial-author">
              <strong>{testimonials[current].name}</strong>
              <span>{testimonials[current].role}</span>
            </div>
            <div className="testimonial-tags">
              <span className="tag">{testimonials[current].region}</span>
              <span className="tag">{testimonials[current].language}</span>
            </div>
          </div>
          <div className="carousel-dots">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={idx === current ? 'active' : ''}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="testimonial-grid">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="testimonial-card">
              <Image
                src={testimonial.avatar}
                alt={`${testimonial.name} avatar`}
                width={64}
                height={64}
                loading="lazy"
                className="testimonial-avatar"
              />
              <blockquote>{testimonial.quote}</blockquote>
              <div className="testimonial-author">
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </div>
              <div className="testimonial-tags">
                <span className="tag">{testimonial.region}</span>
                <span className="tag">{testimonial.language}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
