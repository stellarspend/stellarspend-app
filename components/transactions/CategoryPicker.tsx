"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { STANDARD_CATEGORIES, getCategoryColor } from "@/lib/stellar/categoriesContract";

interface CategoryPickerProps {
  value: string | null;
  onChange: (category: string) => void | Promise<void>;
  disabled?: boolean;
}

export default function CategoryPicker({
  value,
  onChange,
  disabled = false,
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCustomizing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commit = async (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      await onChange(trimmed);
      setIsOpen(false);
      setIsCustomizing(false);
      setCustomValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const colors = value ? getCategoryColor(value) : null;
  const busy = disabled || isSubmitting;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => !busy && setIsOpen((open) => !open)}
        disabled={busy}
        className={`w-full px-4 py-3 bg-white/[0.02] border rounded-xl text-left font-semibold flex items-center justify-between transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? "border-[#e8b84b]" : "border-white/10 hover:border-white/20"
        }`}
      >
        {value ? (
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors?.bg} ${colors?.text} ${colors?.border}`}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-[#7a8aaa]">Assign a category…</span>
        )}
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 text-[#e8b84b] animate-spin" />
        ) : (
          <ChevronDown
            className={`w-4 h-4 text-[#7a8aaa] transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f1420] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {!isCustomizing ? (
            <>
              {STANDARD_CATEGORIES.map((category) => {
                const optionColors = getCategoryColor(category);
                const isSelected = value === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => commit(category)}
                    className={`w-full px-4 py-3 text-left text-sm font-semibold flex items-center justify-between transition-all ${
                      isSelected
                        ? "bg-white/[0.06]"
                        : "text-white hover:bg-white/5"
                    }`}
                  >
                    <span className={`${optionColors.text}`}>{category}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#e8b84b]" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-[#7a8aaa] hover:bg-white/5 border-t border-white/5 transition-all"
              >
                Custom category…
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commit(customValue);
              }}
              className="p-3 flex items-center gap-2"
            >
              <input
                autoFocus
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="e.g. Subscriptions"
                maxLength={40}
                className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder-[#7a8aaa]/50 outline-none focus:border-[#e8b84b]/50"
              />
              <button
                type="submit"
                disabled={!customValue.trim() || isSubmitting}
                className="px-3 py-2 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
