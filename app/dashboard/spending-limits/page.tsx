"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Sliders,
  Coins,
  Activity,
  AlertCircle,
  X,
  Lock,
  Loader2,
} from "lucide-react";
import {
  getLimits,
  setLimit,
  deleteLimit,
  SpendingLimit,
  SpendingPeriod,
  AssetCode,
} from "@/lib/stellar/spendingLimitsContract";
import SpendingLimitCard from "@/components/spending-limits/SpendingLimitCard";
import { useNotifications } from "@/context/NotificationContext";
import { useOffline } from "@/components/offline/OfflineProvider";
import useWallet from "@/hooks/useWallet";

export default function SpendingLimitsPage() {
  const { freighter } = useWallet();
  const publicKey = freighter.publicKey;
  const { addNotification } = useNotifications();
  const { isOnline, queueAction } = useOffline();

  const [limits, setLimits] = useState<SpendingLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [asset, setAsset] = useState<AssetCode>("USDC");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<SpendingPeriod>("weekly");
  const [formError, setFormError] = useState("");

  const loadLimits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLimits(publicKey || undefined);
      setLimits(data);
    } catch (err) {
      console.error("Error loading spending limits:", err);
      addNotification("error", "Failed to fetch spending limits.");
    } finally {
      setLoading(false);
    }
  }, [publicKey, addNotification]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLimits();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadLimits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getLimits(publicKey || undefined);
      setLimits(data);
      addNotification("info", "Spending limits refreshed.");
    } catch (err) {
      console.error("Error refreshing limits:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid positive limit amount.");
      return;
    }

    setFormError("");

    if (!isOnline) {
      queueAction(
        "SET_SPENDING_LIMIT",
        `Set ${period} limit of ${parsedAmount} ${asset}`,
        { asset, amount: parsedAmount, period }
      );
      addNotification(
        "info",
        `Offline: Limit for ${asset} (${parsedAmount} ${period}) queued.`
      );
      // Optimistic update
      const tempLimit: SpendingLimit = {
        id: `temp_${Date.now()}`,
        publicKey: publicKey || "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        asset,
        limitAmount: parsedAmount,
        spentAmount: 0,
        period,
        periodStart: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLimits((prev) => {
        const existing = prev.findIndex((l) => l.asset === asset);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = tempLimit;
          return updated;
        }
        return [...prev, tempLimit];
      });
      setShowModal(false);
      setAmount("");
      return;
    }

    try {
      setSubmitting(true);
      const newLimit = await setLimit(
        publicKey || "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        asset,
        parsedAmount,
        period
      );

      setLimits((prev) => {
        const existing = prev.findIndex((l) => l.asset === asset);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newLimit;
          return updated;
        }
        return [...prev, newLimit];
      });

      addNotification("success", `Successfully set ${period} limit of ${parsedAmount} ${asset}.`);
      setShowModal(false);
      setAmount("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFormError(errMsg || "Failed to set spending limit.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLimit = async (id: string) => {
    setDeletingId(id);
    try {
      if (!isOnline) {
        queueAction("DELETE_SPENDING_LIMIT", `Delete limit: ${id}`, { id });
        addNotification("info", "Offline: Deletion queued.");
        setLimits((prev) => prev.filter((l) => l.id !== id));
        return;
      }

      await deleteLimit(
        publicKey || "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        id
      );
      setLimits((prev) => prev.filter((l) => l.id !== id));
      addNotification("success", "Spending limit deleted.");
    } catch (err) {
      console.error("Error deleting limit:", err);
      addNotification("error", "Failed to delete spending limit.");
    } finally {
      setDeletingId(null);
    }
  };

  // Metrics calculation
  const totalLimitsCount = limits.length;
  const averageUtilization = totalLimitsCount > 0
    ? Math.round(
        limits.reduce(
          (acc, curr) => acc + (curr.limitAmount > 0 ? (curr.spentAmount / curr.limitAmount) * 100 : 0),
          0
        ) / totalLimitsCount
      )
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full border border-[#e8b84b]/20 bg-[#e8b84b]/[0.08] text-[#e8b84b]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#e8b84b] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
              Security & Policy Controls
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Spending <span className="text-[#e8b84b]">Limits</span>
          </h1>
          <p className="text-[#7a8aaa] mt-1 text-sm max-w-lg leading-relaxed">
            Configure on-chain and ZK-enforced allowances per asset across daily, weekly, or monthly cycles to prevent unauthorized outflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.08] hover:border-white/20 text-[#7a8aaa] hover:text-white transition-all active:scale-95 disabled:opacity-50"
            title="Refresh limits"
            aria-label="Refresh limits"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#e8b84b]" : ""}`} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-2xl shadow-xl shadow-[#e8b84b]/10 transition-all hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Set New Limit</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-[#0c1020]/90 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
              Active Rules
            </span>
            <div className="p-2 rounded-xl bg-white/5 text-[#e8b84b]">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">
            {totalLimitsCount}{" "}
            <span className="text-xs font-semibold text-[#7a8aaa]">Asset Rules</span>
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-[#0c1020]/90 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
              Avg Period Utilization
            </span>
            <div className="p-2 rounded-xl bg-white/5 text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2">
            {averageUtilization}%{" "}
            <span className="text-xs font-semibold text-[#7a8aaa]">of cap spent</span>
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-[#0c1020]/90 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
              ZK Proof Protection
            </span>
            <div className="p-2 rounded-xl bg-white/5 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2 flex items-center gap-2">
            <span>Enforced</span>
            <span className="text-xs font-semibold text-[#7a8aaa]">via Noir & Soroban</span>
          </p>
        </div>
      </div>

      {/* Main Limits List */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#e8b84b]" />
          <p className="text-sm font-medium text-[#7a8aaa]">Loading spending limits...</p>
        </div>
      ) : limits.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
          <div className="w-16 h-16 rounded-3xl bg-[#e8b84b]/10 border border-[#e8b84b]/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#e8b84b]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">No spending limits set</h3>
          <p className="text-sm text-[#7a8aaa] max-w-sm mx-auto mb-6">
            You haven&apos;t defined any limits yet. Set an asset allowance to prevent unintended large transactions.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#e8b84b]/10 transition-all hover:-translate-y-0.5"
          >
            Set Your First Spending Limit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {limits.map((limit) => (
              <SpendingLimitCard
                key={limit.id}
                limit={limit}
                onDelete={handleDeleteLimit}
                isDeleting={deletingId === limit.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Limit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setShowModal(false)}
              className="absolute inset-0 bg-[#060813]/85 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md rounded-[32px] bg-[#0c1020] border border-white/10 shadow-2xl p-8 overflow-hidden"
            >
              {/* Top ambient highlight */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-[#e8b84b]/10 blur-[50px] pointer-events-none" />

              <button
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/10 text-[#7a8aaa] hover:text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-2xl">
                  <Coins className="w-6 h-6 text-[#e8b84b]" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Set Spending Limit
                  </h2>
                  <p className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider mt-0.5">
                    Allowance Policy Configuration
                  </p>
                </div>
              </div>

              {formError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateLimit} className="space-y-5">
                {/* Asset Selection */}
                <div>
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Select Asset
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["USDC", "XLM", "EURC"] as AssetCode[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAsset(a)}
                        className={`py-3 rounded-2xl text-xs font-bold transition-all border ${
                          asset === a
                            ? "bg-[#e8b84b] text-[#1a0f00] border-[#e8b84b] shadow-lg shadow-[#e8b84b]/20"
                            : "bg-white/[0.03] border-white/10 text-[#7a8aaa] hover:text-white hover:bg-white/[0.06]"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Limit Amount ({asset})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="e.g. 300"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-bold placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all text-sm"
                  />
                </div>

                {/* Period Selection */}
                <div>
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Refresh Period
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "daily", label: "Daily" },
                        { id: "weekly", label: "Weekly" },
                        { id: "monthly", label: "Monthly" },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPeriod(p.id)}
                        className={`py-3 rounded-2xl text-xs font-bold transition-all border ${
                          period === p.id
                            ? "bg-white/10 text-white border-white/30"
                            : "bg-white/[0.02] border-white/5 text-[#7a8aaa] hover:text-white hover:bg-white/[0.05]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-2xl transition-all shadow-xl shadow-[#e8b84b]/10 active:scale-[0.99] uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving Limit...
                      </>
                    ) : (
                      "Save Spending Limit"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
