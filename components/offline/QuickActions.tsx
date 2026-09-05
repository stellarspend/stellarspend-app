"use client";

import React, { useState } from 'react';
import { X, Send, Download, PieChart, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SendPaymentModal from '../transactions/SendPaymentModal';

// Module-level constant — Math.random() runs once when the module loads,
// never during a component render, so the react-hooks/purity rule is satisfied.
const QR_CELLS: readonly boolean[] = Array.from(
  { length: 16 },
  () => Math.random() > 0.5,
);

// ─── Mini Receive Modal ──────────────────────────────────────────────────────
function ReceiveModal({ onClose }: { onClose: () => void }) {
  const address = "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            {QR_CELLS.map((filled, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm ${filled ? "bg-[#e8b84b]" : "bg-transparent"}`}
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
        <h2 className="text-2xl font-bold text-white mb-1">New Budget</h2>
        <p className="text-[#7a8aaa] text-sm mb-6">
          Set a monthly spending limit by category.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Category
            </label>
            <input
              type="text"
              placeholder="e.g. Food, Transport…"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#7a8aaa]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[#7a8aaa] text-xs uppercase tracking-widest mb-2 block">
              Monthly Limit (USDC)
            </label>
            <input
              type="number"
              placeholder="0.00"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#7a8aaa]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
            />
          </div>
          <button className="w-full py-3 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-xl hover:bg-[#f0c85a] transition-all hover:-translate-y-0.5 shadow-lg shadow-[#e8b84b]/20 active:translate-y-0 mt-2">
            Create Budget
          </button>
        </div>
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
