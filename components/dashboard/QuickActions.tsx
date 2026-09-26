"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Download, PieChart, Target, X, Loader2, AlertCircle } from "lucide-react";
import SendPaymentModal from "../transactions/SendPaymentModal";
import useWallet from "@/hooks/useWallet";
import { useOffline } from "@/components/offline/OfflineProvider";
import { useNotifications } from "@/context/NotificationContext";
import { createBudget, isBudgetContractConfigured } from "@/lib/stellar/budgetContract";
import type { Budget } from "@/lib/api/client";

// ─── Mini Receive Modal ──────────────────────────────────────────────────────
function ReceiveModal({ onClose }: { onClose: () => void }) {
  const address = "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate QR pattern once to avoid Math.random() in render
  const [qrPattern] = useState(() => {
    return Array.from({ length: 16 }).map(() => Math.random() > 0.5);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-[#0d1420] border border-white/10 shadow-2xl p-8 text-center"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#7a8aaa] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-white mb-1">Receive Assets</h2>
        <p className="text-[#7a8aaa] text-sm mb-6">
          Share your Stellar address to receive funds.
        </p>
        {/* QR placeholder — uses module-level constant, never re-computed on render */}
        <div className="w-36 h-36 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <div className="grid grid-cols-4 gap-1 p-3 opacity-50">
            {qrPattern.map((isFilled, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm ${isFilled ? "bg-[#e8b84b]" : "bg-transparent"}`}
              />
            ))}
          </div>
        </div>
        <p className="text-[10px] font-mono text-[#7a8aaa] break-all mb-4 px-2">
          {address}
        </p>
        <button
          onClick={copy}
          className="w-full py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
        >
          {copied ? "✓ Copied!" : "Copy Address"}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Budget / Goal Modals ────────────────────────────────────────────────────
function BudgetModal({ onClose }: { onClose: () => void }) {
  const { freighter } = useWallet();
  const publicKey = freighter.publicKey;
  const { isOnline, queueAction } = useOffline();
  const { addNotification } = useNotifications();

  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [asset, setAsset] = useState<Budget["asset"]>("USDC");
  const [formError, setFormError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedLimit = parseFloat(limit);
  const isValid =
    category.trim().length > 0 &&
    !Number.isNaN(parsedLimit) &&
    parsedLimit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setFormError("Enter a category and a positive monthly limit.");
      return;
    }
    setFormError(null);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const budgetData: Omit<Budget, "id" | "createdAt" | "updatedAt"> = {
      name: category.trim(),
      category: category.trim().toLowerCase(),
      amount: parsedLimit,
      asset,
      startDate: now.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };

    if (!isOnline) {
      queueAction("CREATE_BUDGET", `Create budget: ${budgetData.name}`, budgetData);
      addNotification(
        "success",
        `Offline: Your budget "${budgetData.name}" has been queued and will be saved when you reconnect.`
      );
      onClose();
      return;
    }

    // Without a deployed budget contract, createBudget falls back to the
    // localStorage data layer, so a wallet is only needed for the on-chain path.
    if (isBudgetContractConfigured() && !publicKey) {
      setFormError("Connect your Freighter wallet to persist this budget on-chain.");
      return;
    }

    try {
      setSubmitting(true);
      await createBudget(publicKey ?? "", budgetData, (status) => setTxStatus(status));
      addNotification(
        "success",
        `Budget "${budgetData.name}" created successfully. (${parsedLimit} ${asset} / month)`
      );
      onClose();
    } catch (error: unknown) {
      console.error("Failed to create budget:", error);
      const errMessage = error instanceof Error ? error.message : String(error);
      setFormError(errMessage || "Failed to create budget on-chain.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-[#0d1420] border border-white/10 shadow-2xl p-8"
      >
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-5 right-5 text-[#7a8aaa] hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-white mb-1">New Budget</h2>
        <p className="text-[#7a8aaa] text-sm mb-6">
          Set a monthly spending limit by category.
        </p>

        {formError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Groceries, Transport…"
              required
              disabled={submitting}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#7a8aaa]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Monthly Limit ({asset})
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="0.00"
              required
              disabled={submitting}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#7a8aaa]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <span className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Asset
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["USDC", "XLM", "EURC"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAsset(a)}
                  disabled={submitting}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
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

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full py-3 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-xl hover:bg-[#f0c85a] transition-all hover:-translate-y-0.5 shadow-lg shadow-[#e8b84b]/20 active:translate-y-0 mt-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {txStatus || "Processing…"}
              </>
            ) : (
              "Create Budget"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function GoalModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-[#0d1420] border border-white/10 shadow-2xl p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#7a8aaa] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-white mb-1">New Goal</h2>
        <p className="text-[#7a8aaa] text-sm mb-6">
          Define a savings target and track progress.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Goal Name
            </label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund…"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#7a8aaa]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Target Amount (USDC)
            </label>
            <input
              type="number"
              placeholder="0.00"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#7a8aaa]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
            />
          </div>
          <button className="w-full py-3 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-xl hover:bg-[#f0c85a] transition-all hover:-translate-y-0.5 shadow-lg shadow-[#e8b84b]/20 active:translate-y-0 mt-2">
            Create Goal
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

type ModalId = "send" | "receive" | "budget" | "goal" | null;

const ACTIONS = [
  {
    id: "send",
    label: "Send",
    ariaLabel: "Send payment",
    icon: Send,
    color: "#e8b84b",
    bg: "bg-[#e8b84b]/10",
    border: "border-[#e8b84b]/20",
    hover: "hover:border-[#e8b84b]/50 hover:bg-[#e8b84b]/15",
  },
  {
    id: "receive",
    label: "Receive",
    ariaLabel: "Receive payment",
    icon: Download,
    color: "#4ade80",
    bg: "bg-[#4ade80]/10",
    border: "border-[#4ade80]/20",
    hover: "hover:border-[#4ade80]/50 hover:bg-[#4ade80]/15",
  },
  {
    id: "budget",
    label: "New Budget",
    ariaLabel: "Create new budget",
    icon: PieChart,
    color: "#4aa9e8",
    bg: "bg-[#4aa9e8]/10",
    border: "border-[#4aa9e8]/20",
    hover: "hover:border-[#4aa9e8]/50 hover:bg-[#4aa9e8]/15",
  },
  {
    id: "goal",
    label: "New Goal",
    ariaLabel: "Create new savings goal",
    icon: Target,
    color: "#a78bfa",
    bg: "bg-[#a78bfa]/10",
    border: "border-[#a78bfa]/20",
    hover: "hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/15",
  },
] as const;

export default function QuickActions() {
  const [openModal, setOpenModal] = useState<ModalId>(null);

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-5 rounded-full bg-[#e8b84b]" />
          <h2 className="text-sm font-black text-white uppercase tracking-[0.15em]">
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACTIONS.map((action, i) => (
            <motion.button
              key={action.id}
              id={`quick-action-${action.id}`}
              aria-label={action.ariaLabel}
              onClick={() => setOpenModal(action.id as ModalId)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border ${action.bg} ${action.border} ${action.hover} transition-all duration-200 group`}
            >
              <div
                className={`p-3 rounded-xl ${action.bg} border ${action.border}`}
              >
                <action.icon
                  className="w-5 h-5"
                  style={{ color: action.color }}
                />
              </div>
              <span className="text-xs font-bold text-[#e8edf8] uppercase tracking-wider group-hover:text-white transition-colors">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {openModal === "send" && (
          <SendPaymentModal onClose={() => setOpenModal(null)} />
        )}
        {openModal === "receive" && (
          <ReceiveModal onClose={() => setOpenModal(null)} />
        )}
        {openModal === "budget" && (
          <BudgetModal onClose={() => setOpenModal(null)} />
        )}
        {openModal === "goal" && (
          <GoalModal onClose={() => setOpenModal(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
