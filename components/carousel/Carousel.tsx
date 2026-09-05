"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import "@/styles/carousel.css";

export interface CarouselSlide {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  stat?: string;
  statLabel?: string;
}

interface CarouselProps {
  slides: CarouselSlide[];
  autoAdvanceMs?: number;
}

export default function Carousel({
  slides,
  autoAdvanceMs = 4000,
}: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (index: number) => {
      setCurrent((index + slides.length) % slides.length);
    },
    [slides.length],
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(next, autoAdvanceMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, next, autoAdvanceMs]);

  // Keyboard controls on the track
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  }

  // Touch swipe
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const delta = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) {
        next();
      } else {
        prev();
      }
    }
    setTouchStart(null);
  }

  return (
    <section
      className="carousel"
      aria-label="Feature highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {/* Live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {slides[current].title}. {slides[current].description}. Slide{" "}
        {current + 1} of {slides.length}.
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="carousel__track"
        role="group"
        aria-label={`Slide ${current + 1} of ${slides.length}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={`carousel__slide${i === current ? " carousel__slide--active" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${slide.title}`}
            aria-hidden={i !== current}
            inert={i !== current ? true : undefined}
          >
            <div className="carousel__slide-icon" aria-hidden="true">
              {slide.icon}
            </div>
            <h3 className="carousel__slide-title">{slide.title}</h3>
            <p className="carousel__slide-desc">{slide.description}</p>
            {slide.stat && (
              <div className="carousel__slide-stat">
                <span className="carousel__stat-value">{slide.stat}</span>
                <span className="carousel__stat-label">{slide.statLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div
        className="carousel__controls"
        role="group"
        aria-label="Carousel controls"
      >
        <button
          className="carousel__btn carousel__btn--prev"
          onClick={prev}
          tabIndex={0}
          aria-label="Previous slide"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Dots */}
        <div
          className="carousel__dots"
          role="tablist"
          aria-label="Slide navigation"
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to slide ${i + 1}: ${slide.title}`}
              className={`carousel__dot${i === current ? " carousel__dot--active" : ""}`}
              onClick={() => goTo(i)}
              tabIndex={i === current ? 0 : -1}
            />
          ))}
        </div>

        <button
          className="carousel__btn carousel__btn--next"
          onClick={next}
          tabIndex={0}
          aria-label="Next slide"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Pause indicator */}
      <div className="carousel__pause-hint" aria-hidden="true">
        {paused ? "⏸" : "▶"}
      </div>
    </section>
  );
}
