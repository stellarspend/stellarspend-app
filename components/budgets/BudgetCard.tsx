"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Coins,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Budget } from "@/lib/api/client";

interface BudgetCardProps {
  budget: Budget;
  spent?: number;
  onSaveEdit: (id: string, amount: number) => Promise<void> | void;
  onDelete: (budget: Budget) => Promise<void> | void;
}

function formatAmount(val: number): string {
  return val % 1 === 0 ? val.toString() : val.toFixed(2);
}

function getAssetBadgeColor(asset: Budget["asset"]): string {
  switch (asset) {
    case "USDC":
      return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    case "EURC":
      return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
    case "XLM":
    default:
      return "bg-[#e8b84b]/10 border-[#e8b84b]/20 text-[#e8b84b]";
  }
}

function getStatusColor(percentUsed: number): string {
  if (percentUsed >= 90) return "text-red-400";
  if (percentUsed >= 70) return "text-amber-400";
  return "text-emerald-400";
}

function getProgressBarGradient(percentUsed: number): string {
  if (percentUsed >= 90) return "from-red-500 to-rose-400";
  if (percentUsed >= 70) return "from-amber-500 to-orange-400";
  return "from-[#e8b84b] to-[#f0c85a]";
}

export default function BudgetCard({
  budget,
  spent = 0,
  onSaveEdit,
  onDelete,
}: BudgetCardProps) {
  const [editing, setEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(String(budget.amount));
  const [saving, setSaving] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const percentUsed =
    budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
  const remaining = Math.max(0, budget.amount - spent);
  const statusColor = getStatusColor(percentUsed);
  const assetBadge = getAssetBadgeColor(budget.asset);

  const startEdit = () => {
    setEditingValue(String(budget.amount));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditingValue(String(budget.amount));
  };

  const handleSaveEdit = async () => {
    const nextAmount = parseFloat(editingValue);
    if (Number.isNaN(nextAmount) || nextAmount <= 0) return;
    setSaving(true);
    try {
      await onSaveEdit(budget.id, nextAmount);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(budget);
      setShowConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      layout
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
              className={`p-2.5 rounded-2xl border flex items-center justify-center ${assetBadge}`}
            >
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight capitalize">
                {budget.name}
              </h3>
              <p className="text-xs text-[#7a8aaa] flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {new Date(budget.startDate).toLocaleDateString()} -{" "}
                  {new Date(budget.endDate).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {!editing && !showConfirmDelete && (
              <button
                onClick={startEdit}
                className="p-2 rounded-xl text-[#7a8aaa] hover:text-[#e8b84b] hover:bg-white/5 border border-transparent hover:border-white/10 transition-all active:scale-95"
                title="Edit budget amount"
                aria-label={`Edit ${budget.name} budget`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {!editing && (
              <button
                onClick={() => setShowConfirmDelete(true)}
                disabled={deleting}
                className="p-2 rounded-xl text-[#7a8aaa] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                title="Delete budget"
                aria-label={`Delete ${budget.name} budget`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation Alert */}
        {showConfirmDelete && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs">
            <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Delete this budget?</span>
            </div>
            <p className="text-[#7a8aaa] text-[11px] mb-3">
              This permanently removes &quot;{budget.name}&quot; ({formatAmount(budget.amount)}{" "}
              {budget.asset} / month).
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
              >
                {deleting ? (
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
                disabled={deleting}
                className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-[#7a8aaa] hover:text-white rounded-xl transition-all text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Amount / inline edit */}
        {editing ? (
          <div className="mb-5 p-3.5 rounded-2xl bg-white/[0.03] border border-[#e8b84b]/30">
            <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider mb-2">
              Monthly Limit ({budget.asset})
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0.01"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                autoFocus
                aria-label="Updated monthly limit"
                className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white font-bold placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all text-sm"
              />
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="p-2.5 rounded-xl bg-[#e8b84b] text-[#1a0f00] hover:bg-[#f0c85a] transition-all disabled:opacity-50"
                title="Save amount"
                aria-label="Save budget amount"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#7a8aaa] hover:text-white transition-all disabled:opacity-50"
                title="Cancel"
                aria-label="Cancel budget edit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider">
                Monthly Limit
              </p>
              <p className="text-2xl font-black text-white mt-0.5">
                {formatAmount(budget.amount)}{" "}
                <span className="text-sm font-bold text-[#e8b84b]">{budget.asset}</span>
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-[#7a8aaa] capitalize">
              {budget.category}
            </span>
          </div>
        )}

        {/* Progress Bar Section */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-[#7a8aaa] font-medium uppercase tracking-wider text-[10px]">
              Spent vs Limit
            </span>
            <span className={`font-mono font-bold ${statusColor}`}>
              {percentUsed.toFixed(1)}% ({formatAmount(spent)} /{" "}
              {formatAmount(budget.amount)} {budget.asset})
            </span>
          </div>

          <div className="w-full h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden p-[2px]">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${getProgressBarGradient(percentUsed)}`}
              initial={{ width: "0%" }}
              animate={{ width: `${percentUsed}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Stat Blocks */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider">
              Limit
            </p>
            <p className="text-base font-black text-white mt-0.5">
              {formatAmount(budget.amount)}{" "}
              <span className="text-xs font-normal text-[#7a8aaa]">{budget.asset}</span>
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider">
              Spent
            </p>
            <p className={`text-base font-black mt-0.5 ${statusColor}`}>
              {formatAmount(spent)}{" "}
              <span className="text-xs font-normal text-[#7a8aaa]">{budget.asset}</span>
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-[#7a8aaa] uppercase font-bold tracking-wider">
              Remaining
            </p>
            <p className="text-base font-black text-white mt-0.5">
              {formatAmount(remaining)}{" "}
              <span className="text-xs font-normal text-[#7a8aaa]">{budget.asset}</span>
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
              <span className="text-emerald-400 font-semibold">Within Budget</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#7a8aaa]/80">
          <Coins className="w-3 h-3 text-[#e8b84b]" />
          <span>On-Chain</span>
        </div>
      </div>
    </motion.div>
  );
}