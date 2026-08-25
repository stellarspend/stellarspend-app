"use client";

import React, { useEffect, useState, useRef } from "react";
import { Tag, Check, Loader2, ChevronDown } from "lucide-react";
import { CATEGORIES, getCategoryById } from "@/lib/constants/categories";
import {
  setTransactionCategory,
  getTransactionCategory,
  getMerchantCategoryHint,
  TagResult,
} from "@/lib/stellar/merchantTagging";
import { getConnectedPublicKey } from "@/lib/api/client";

interface CategoryPickerProps {
  txHash: string;
  merchantAddress?: string;
  currentCategoryId?: string;
  onCategoryChanged?: (categoryId: string) => void;
  /** Render mode: 'inline' for the compact pill in TransactionItem, 'full' for the drawer. */
  variant?: "inline" | "full";
}

export default function CategoryPicker({
  txHash,
  merchantAddress,
  currentCategoryId,
  onCategoryChanged,
  variant = "inline",
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | undefined>(currentCategoryId);
  const [autoHint, setAutoHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const publicKey = getConnectedPublicKey();

  // On mount, check if there's a stored category for this transaction
  useEffect(() => {
    if (!publicKey || currentCategoryId) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await getTransactionCategory(publicKey, txHash);
        if (cancelled) return;
        if (result) {
          setCategoryId(result.categoryId);
        } else if (merchantAddress) {
          const hint = await getMerchantCategoryHint(publicKey, merchantAddress);
          if (!cancelled && hint) {
            setAutoHint(hint);
          }
        }
      } catch {
        // Silently fail — latency for a hint is fine to miss
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicKey, txHash, merchantAddress, currentCategoryId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = async (id: string) => {
    if (id === categoryId) {
      setOpen(false);
      return;
    }

    setLoading(true);
    setStatusMsg("Saving...");
    try {
      await setTransactionCategory(
        publicKey!,
        txHash,
        id,
        merchantAddress,
        (msg) => setStatusMsg(msg),
      );
      setCategoryId(id);
      setAutoHint(null);
      onCategoryChanged?.(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save category";
      setStatusMsg(msg);
      // Keep the picker open on error so user can retry
      return;
    } finally {
      setLoading(false);
    }
    setOpen(false);
  };

  const currentDef = categoryId ? getCategoryById(categoryId) : undefined;
  const hintDef = autoHint ? getCategoryById(autoHint) : undefined;

  if (variant === "inline") {
    return (
      <div ref={containerRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
            currentDef
              ? `${currentDef.badge} hover:brightness-110`
              : "bg-white/[0.03] text-[#7a8aaa] border-white/10 hover:border-[#e8b84b]/30 hover:text-[#e8b84b]"
          }`}
          title={currentDef ? `Category: ${currentDef.label}` : "Assign category"}
        >
          <Tag className="w-3 h-3" />
          <span className="max-w-[80px] truncate">
            {currentDef ? currentDef.label : "Uncategorized"}
          </span>
          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
        </button>

        {hintDef && !categoryId && (
          <span
            className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e8b84b]/10 border border-[#e8b84b]/20 text-[#e8b84b] text-[9px] font-bold uppercase cursor-pointer hover:brightness-110 transition-all"
            onClick={() => handleSelect(autoHint!)}
            title={`Auto-suggest: ${hintDef.label}`}
          >
            Suggested: {hintDef.label}
          </span>
        )}

        {open && (
          <div className="absolute top-full left-0 mt-2 z-50 w-52 rounded-2xl border border-white/10 bg-[#0c1020] shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-1.5">
              <div className="text-[9px] font-black text-[#7a8aaa] uppercase tracking-[0.2em] px-3 py-2">
                Assign Category
              </div>
              {statusMsg && (
                <div className="px-3 py-1.5 text-[10px] text-[#7a8aaa] font-medium">
                  {statusMsg}
                </div>
              )}
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat.id)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    categoryId === cat.id
                      ? "bg-white/[0.06] text-white"
                      : "text-[#e8edf8] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cat.id === "food"
                          ? "bg-amber-400"
                          : cat.id === "transport"
                            ? "bg-sky-400"
                            : cat.id === "housing"
                              ? "bg-violet-400"
                              : cat.id === "utilities"
                                ? "bg-emerald-400"
                                : "bg-pink-400"
                      }`}
                    />
                    {cat.label}
                  </span>
                  {categoryId === cat.id && (
                    <Check className="w-3.5 h-3.5 text-[#e8b84b]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant — for the drawer
  return (
    <div ref={containerRef} className="space-y-3">
      <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.15em] block">
        Spending Category
      </label>

      {currentDef ? (
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentDef.badge}`}>
            {currentDef.label}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={loading}
            className="text-[10px] font-bold text-[#e8b84b] hover:text-[#f0c85a] uppercase tracking-wider transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {hintDef && (
            <button
              type="button"
              onClick={() => handleSelect(autoHint!)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e8b84b]/20 bg-[#e8b84b]/10 text-[#e8b84b] text-xs font-bold hover:brightness-110 transition-all"
            >
              <Tag className="w-3.5 h-3.5" />
              Auto-suggest: {hintDef.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/10 text-[#7a8aaa] text-xs font-semibold hover:border-[#e8b84b]/30 hover:text-[#e8b84b] transition-all w-full"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Tag className="w-4 h-4" />
            )}
            <span>{loading ? statusMsg || "Saving..." : "Assign a category"}</span>
          </button>
        </div>
      )}

      {open && (
        <div className="rounded-2xl border border-white/10 bg-[#0c1020] shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-1.5">
            {statusMsg && !loading && (
              <div className="px-3 py-1.5 text-[10px] text-[#7a8aaa] font-medium">
                {statusMsg}
              </div>
            )}
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat.id)}
                disabled={loading}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  categoryId === cat.id
                    ? "bg-white/[0.06] text-white"
                    : "text-[#e8edf8] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      cat.id === "food"
                        ? "bg-amber-400"
                        : cat.id === "transport"
                          ? "bg-sky-400"
                          : cat.id === "housing"
                            ? "bg-violet-400"
                            : cat.id === "utilities"
                              ? "bg-emerald-400"
                              : "bg-pink-400"
                    }`}
                  />
                  {cat.label}
                </span>
                {categoryId === cat.id && (
                  <Check className="w-4 h-4 text-[#e8b84b]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}