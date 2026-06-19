"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { fetchTransactions, type Transaction } from "@/lib/api/client";

function TxRow({ tx, index }: { tx: Transaction; index: number }) {
  const op = tx.operations[0];
  const isOut = op?.type === "payment" && op.from?.startsWith("GDQD");
  const failed = !tx.successful;

  const iconBg = failed
    ? "bg-red-500/10 text-red-400 border-red-500/20"
    : isOut
      ? "bg-[#e8b84b]/10 text-[#e8b84b] border-[#e8b84b]/20"
      : "bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20";

  const Icon = failed ? AlertCircle : isOut ? ArrowUpRight : ArrowDownLeft;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/[0.03] transition-all group border border-transparent hover:border-white/5"
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${iconBg}`}
      >
        <Icon className="w-4.5 h-4.5" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-[#e8b84b] transition-colors">
          {tx.memo || "Unlabeled"}
        </p>
        <p className="text-[10px] text-[#7a8aaa] font-mono mt-0.5 truncate">
          {new Date(tx.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        {op?.amount ? (
          <>
            <p className="text-sm font-black text-white">
              {isOut ? "-" : "+"}
              {op.amount}
            </p>
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${failed ? "text-red-400" : "text-[#e8b84b]"}`}
            >
              {op.asset_code}
            </p>
          </>
        ) : (
          <span className="text-xs text-[#7a8aaa]">--</span>
        )}
      </div>

      {/* Status dot */}
      <div
        className={`flex-shrink-0 w-2 h-2 rounded-full ${failed ? "bg-red-400" : "bg-[#4ade80]"}`}
      />
    </motion.div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-white/10" />
        <div className="h-2 w-20 rounded bg-white/10" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3 w-16 rounded bg-white/10" />
        <div className="h-2 w-10 rounded bg-white/10" />
      </div>
    </div>
  );
}

function EmptyTransactionsState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e8b84b]/20 bg-[#e8b84b]/10 text-[#e8b84b]">
        <ArrowDownUp className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-white">
        No transactions yet. Send or receive funds to get started.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#7a8aaa]">
        Your latest Stellar activity will appear here once your wallet has completed transfers.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/dashboard#quick-action-send"
          className="inline-flex min-w-32 items-center justify-center rounded-xl bg-[#e8b84b] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[#1a0f00] transition-all hover:-translate-y-0.5 hover:bg-[#f0c85a] focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/40"
        >
          Send funds
        </Link>
        <Link
          href="/dashboard#quick-action-receive"
          className="inline-flex min-w-32 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          Receive funds
        </Link>
      </div>
    </div>
  );
}

export default function RecentTransactions() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions(undefined, 1, 3).then((response) => {
      setTxs(response.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-[#e8b84b]" />
          <h2 className="text-sm font-black text-white uppercase tracking-[0.15em]">
            Recent Transactions
          </h2>
        </div>
        <Link
          href="/dashboard/transactions"
          id="view-all-transactions"
          className="flex items-center gap-1 text-xs text-[#e8b84b] font-bold uppercase tracking-widest hover:text-white transition-colors group"
        >
          View all
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* List */}
      <div className="space-y-1">
        {loading ? (
          [0, 1, 2].map((i) => <SkeletonRow key={i} />)
        ) : txs.length === 0 ? (
          <EmptyTransactionsState />
        ) : (
          txs.map((tx, i) => <TxRow key={tx.id} tx={tx} index={i} />)
        )}
      </div>

      {/* Footer link */}
      {!loading && txs.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/5">
          <Link
            href="/dashboard/transactions"
            className="flex items-center justify-center gap-2 text-xs text-[#7a8aaa] hover:text-[#e8b84b] transition-colors group font-bold uppercase tracking-widest"
          >
            Full transaction history
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
}
