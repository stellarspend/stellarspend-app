"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Coins,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { SpendingLimit } from "@/lib/stellar/spendingLimitsContract";

interface SpendingLimitCardProps {
  limit: SpendingLimit;
  onDelete: (id: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export default function SpendingLimitCard({
  limit,
  onDelete,
  isDeleting = false,
}: SpendingLimitCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const percentUsed = limit.limitAmount > 0
    ? Math.min(100, Math.round((limit.spentAmount / limit.limitAmount) * 100))
    : 0;

  const remaining = Math.max(0, limit.limitAmount - limit.spentAmount);

  // Status color logic
  const getStatusColor = () => {
    if (percentUsed >= 90) return "text-red-400";
    if (percentUsed >= 70) return "text-amber-400";
    return "text-emerald-400";
  };

  const getProgressBarGradient = () => {
    if (percentUsed >= 90) return "from-red-500 to-rose-400";
    if (percentUsed >= 70) return "from-amber-500 to-orange-400";
    return "from-[#e8b84b] to-[#f0c85a]";
  };

  const getAssetBadgeColor = () => {
    switch (limit.asset) {
      case "USDC":
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      case "EURC":
        return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
      case "XLM":
      default:
        return "bg-[#e8b84b]/10 border-[#e8b84b]/20 text-[#e8b84b]";
    }
  };

  const formatAmount = (val: number) => {
    return val % 1 === 0 ? val.toString() : val.toFixed(2);
  };

  const handleDeleteClick = async () => {
    await onDelete(limit.id);
    setShowConfirmDelete(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="relative rounded-3xl bg-[#0c1020]/90 border border-white/10 p-6 backdrop-blur-xl shadow-xl hover:border-white/20 transition-all duration-300 overflow-hidden group flex flex-col justify-between"
    >
      {/* Ambient background glow */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none ${
          percentUsed >= 90
            ? "bg-red-500"
            : percentUsed >= 70
            ? "bg-amber-500"
            : "bg-[#e8b84b]"
        }`}
      />

      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl border flex items-center justify-center ${getAssetBadgeColor()}`}
            >
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">
                  {limit.asset}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-[#7a8aaa]">
                  {limit.period}
                </span>
              </div>
              <p className="text-xs text-[#7a8aaa] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Resets {limit.period === "daily" ? "every 24h" : limit.period === "weekly" ? "every 7 days" : "every month"}
                </span>
              </p>
            </div>
          </div>

          {/* Delete Action Button */}
          {!showConfirmDelete && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={isDeleting}
              className="p-2 rounded-xl text-[#7a8aaa] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
              title="Delete spending limit"
              aria-label={`Delete ${limit.asset} limit`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Delete Confirmation Alert */}
        <AnimatePresence>
          {showConfirmDelete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs overflow-hidden"
            >
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Delete this limit?</span>
              </div>
              <p className="text-[#7a8aaa] text-[11px] mb-3">
                This will remove the {limit.asset} {limit.period} cap of {formatAmount(limit.limitAmount)} {limit.asset}.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-[#7a8aaa] hover:text-white rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Bar Section */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-[#7a8aaa] font-medium uppercase tracking-wider text-[10px]">
              Period Utilization
            </span>
            <span className={`font-mono font-bold ${getStatusColor()}`}>
              {percentUsed}% ({formatAmount(limit.spentAmount)} / {formatAmount(limit.limitAmount)} {limit.asset})
            </span>
          </div>

          <div className="w-full h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden p-[2px]">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${getProgressBarGradient()}`}
              initial={{ width: "0%" }}
              animate={{ width: `${percentUsed}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Stat Blocks */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider">
              Spent
            </p>
            <p className="text-base font-black text-white mt-0.5">
              {formatAmount(limit.spentAmount)}{" "}
              <span className="text-xs font-normal text-[#7a8aaa]">{limit.asset}</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider">
              Remaining
            </p>
            <p className={`text-base font-black mt-0.5 ${getStatusColor()}`}>
              {formatAmount(remaining)}{" "}
              <span className="text-xs font-normal text-[#7a8aaa]">{limit.asset}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between text-[11px] text-[#7a8aaa]">
        <div className="flex items-center gap-1.5">
          {percentUsed >= 100 ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-semibold">Limit Reached</span>
            </>
          ) : percentUsed >= 70 ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-semibold">High Utilization</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Within Limit</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#7a8aaa]/80">
          <ShieldCheck className="w-3 h-3 text-[#e8b84b]" />
          <span>ZK Protected</span>
        </div>
      </div>
    </motion.div>
  );
}
