"use client";

import Image from "next/image";
import { motion } from "framer-motion";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  avatarSrc: string;
  region?: string;
  language?: string;
  index: number;
}

export default function TestimonialCard({
  quote,
  author,
  role,
  avatarSrc,
  region,
  language,
  index,
}: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#e8b84b]/20 transition-all duration-300 h-full flex flex-col"
      role="article"
      aria-label={`Testimonial from ${author}`}
    >
      {/* Quote */}
      <blockquote
        className="text-[#e8edf8] text-base leading-relaxed mb-6 italic flex-grow"
        aria-label="Testimonial quote"
      >
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Author Info */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#e8b84b]/20 flex-shrink-0">
          <Image
            src={avatarSrc}
            alt={`${author}'s profile picture`}
            fill
            sizes="48px"
            className="object-cover"
            loading={index === 0 ? "eager" : "lazy"}
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiMxYTFhMmUiLz48L3N2Zz4="
          />
        </div>
        <div className="flex-grow">
          <p className="text-white font-semibold text-sm">{author}</p>
          <p className="text-[var(--color-text-secondary)] text-xs">{role}</p>
        </div>
      </div>

      {/* Region/Language Tags */}
      {(region || language) && (
        <div
          className="flex flex-wrap gap-2"
          aria-label="Location and language information"
        >
          {region && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#e8b84b]/10 text-[#e8b84b] border border-[#e8b84b]/20">
              📍 {region}
            </span>
          )}
          {language && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
              🌐 {language}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
