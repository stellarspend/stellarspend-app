"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { fetchTransactions, type Transaction } from "@/lib/api/client";
import {
  PAYMENT_CONFIRMED_EVENT,
  PAYMENT_SUBMITTED_EVENT,
  toTransactionRecord,
  type PendingPayment,
  type SubmittedPayment,
} from "@/lib/stellar/submitTransaction";

function TxRow({ tx, index }: { tx: Transaction; index: number }) {
  const op = tx.operations[0];
  const isOut = op?.type === "payment" && op.from?.startsWith("GDQD");
  const failed = !tx.successful;
  const pending = tx.status === "pending";

  const iconBg = failed
    ? "bg-red-500/10 text-red-400 border-red-500/20"
    : pending
      ? "bg-[#e8b84b]/10 text-[#e8b84b] border-[#e8b84b]/20"
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
          <span className="text-xs text-[#7a8aaa]">—</span>
        )}
      </div>

      {/* Status dot */}
      <div
        className={`flex-shrink-0 w-2 h-2 rounded-full ${failed ? "bg-red-400" : pending ? "bg-[#e8b84b] animate-pulse" : "bg-[#4ade80]"}`}
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

export default function RecentTransactions() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const livePaymentStatus = React.useRef(new Map<string, "pending" | "confirmed">());

  useEffect(() => {
    fetchTransactions(undefined, 1, 3).then((response) => {
      setTxs(response.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handlePaymentSubmitted = (event: Event) => {
      const payment = (event as CustomEvent<PendingPayment>).detail;
      if (!payment || livePaymentStatus.current.has(payment.hash)) return;
      livePaymentStatus.current.set(payment.hash, "pending");
      const transaction = toTransactionRecord(payment, "pending");
      setTxs((current) => {
        if (current.some((item) => item.hash === transaction.hash)) return current;
        return [transaction, ...current].slice(0, 3);
      });
    };

    const handlePaymentConfirmed = (event: Event) => {
      const payment = (event as CustomEvent<SubmittedPayment>).detail;
      if (!payment || livePaymentStatus.current.get(payment.hash) === "confirmed") return;
      livePaymentStatus.current.set(payment.hash, "confirmed");
      const transaction = toTransactionRecord(payment, "confirmed");
      setTxs((current) => [
        transaction,
        ...current.filter((item) => item.hash !== transaction.hash),
      ].slice(0, 3));
    };

    window.addEventListener(PAYMENT_SUBMITTED_EVENT, handlePaymentSubmitted);
    window.addEventListener(PAYMENT_CONFIRMED_EVENT, handlePaymentConfirmed);
    return () => {
      window.removeEventListener(PAYMENT_SUBMITTED_EVENT, handlePaymentSubmitted);
      window.removeEventListener(PAYMENT_CONFIRMED_EVENT, handlePaymentConfirmed);
    };
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
          aria-label="View all transactions"
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 px-4"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
              <Inbox className="w-7 h-7 text-[#7a8aaa]" />
            </div>
            <p className="text-[#7a8aaa] text-sm max-w-xs mx-auto leading-relaxed">
              No transactions yet. Send or receive funds to get started.
            </p>
            <Link
              href="/dashboard/transactions"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-xl shadow-lg shadow-[#e8b84b]/20 transition-all hover:-translate-y-0.5 active:translate-y-0 text-xs uppercase tracking-wider group"
            >
              Send or Receive
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
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
