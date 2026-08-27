"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  ariaLabel?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="relative w-full overflow-visible z-[9999]"
      ref={containerRef}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-[#0f1420] border border-[#e8b84b]/60 rounded-xl text-white text-left font-semibold flex items-center justify-between hover:border-[#e8b84b] transition-all outline-none"
        aria-label={ariaLabel}
      >
        <span>{selectedOption?.label || "Select..."}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f1420] border border-[#e8b84b]/60 rounded-xl shadow-2xl shadow-black/50 z-[9999] overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-semibold transition-all ${
                value === option.value
                  ? "bg-[#e8b84b]/20 text-[#e8b84b] border-l-4 border-l-[#e8b84b]"
                  : "text-white hover:bg-white/5"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
