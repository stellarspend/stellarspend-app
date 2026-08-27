"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  ExternalLink,
  Download,
  ArrowDownLeft,
  Clock,
  Hash,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Operation {
  id: string;
  type: string;
  amount?: string;
  asset_code?: string;
  from?: string;
  to?: string;
  starting_balance?: string;
  funder?: string;
  account?: string;
}

interface TransactionDetails {
  id: string;
  hash: string;
  created_at: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  memo?: string;
  memo_type?: string;
  successful: boolean;
  source_account: string;
  ledger: number;
  operations: Operation[];
  tags?: string[];
}

interface TransactionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionDetails | null;
}

export default function TransactionDrawer({
  isOpen,
  onClose,
  transaction,
}: TransactionDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  // Focus management
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    closeButtonRef.current?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !isOpen) return;

      const focusableElements = drawerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) as NodeListOf<HTMLElement>;

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!transaction) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Transaction hash has been copied to your clipboard.",
    });
  };

  const exportJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(transaction, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `transaction_${transaction.id}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
  };

  const horizonUrl = `https://horizon.stellar.org/transactions/${transaction.hash}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#080b18] border-l border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-title"
            aria-describedby="transaction-description"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-md">
              <div>
                <h2
                  id="transaction-title"
                  className="text-xl font-bold text-white flex items-center gap-2"
                >
                  Transaction Details
                  {transaction.successful ? (
                    <CheckCircle2
                      className="w-5 h-5 text-[#4ade80]"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertCircle
                      className="w-5 h-5 text-[#f87171]"
                      aria-hidden="true"
                    />
                  )}
                </h2>
                <p
                  id="transaction-description"
                  className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-[0.2em] mt-1 font-semibold"
                >
                  Ledger {transaction.ledger}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors border border-transparent hover:border-white/10"
                aria-label="Close transaction details"
              >
                <X className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                      timestamp
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {new Date(transaction.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[#e8b84b] mb-1">
                    <Tag className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                      network fee
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {transaction.fee_charged}{" "}
                    <span className="text-[10px] text-[#e8b84b]">STROOPS</span>
                  </p>
                </div>
              </div>

              {/* Hash & Addresses */}
              <div className="space-y-6">
                <div className="group">
                  <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.15em] mb-2 block">
                    Transaction Hash
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-white/[0.02] border border-white/10 rounded-xl font-mono text-[11px] text-[#e8edf8] break-all leading-relaxed relative group-hover:bg-white/[0.04] transition-colors">
                      {transaction.hash}
                    </div>
                    <button
                      onClick={() => copyToClipboard(transaction.hash)}
                      className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-[var(--color-text-secondary)] hover:text-[#e8b84b] hover:border-[#e8b84b]/30 transition-all active:scale-95"
                      title="Copy Hash"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="group">
                  <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.15em] mb-2 block">
                    Source Account
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-white/[0.02] border border-white/10 rounded-xl font-mono text-[11px] text-[#e8edf8] break-all leading-relaxed group-hover:bg-white/[0.04] transition-colors">
                      {transaction.source_account}
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(transaction.source_account)
                      }
                      className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-[var(--color-text-secondary)] hover:text-[#e8b84b] hover:border-[#e8b84b]/30 transition-all active:scale-95"
                      title="Copy Address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Memo & Tags */}
              {(transaction.memo ||
                (transaction.tags && transaction.tags.length > 0)) && (
                <div className="space-y-5">
                  {transaction.memo && (
                    <div className="p-5 bg-linear-to-br from-[#e8b84b]/[0.05] to-transparent border border-[#e8b84b]/10 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="w-12 h-12" />
                      </div>
                      <div className="flex items-center gap-2 text-[#e8b84b] mb-3 relative z-10">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                          Memo ({transaction.memo_type})
                        </span>
                      </div>
                      <p className="text-sm text-[#e8edf8] italic relative z-10 pl-2 border-l-2 border-[#e8b84b]/30">
                        &ldquo;{transaction.memo}&rdquo;
                      </p>
                    </div>
                  )}

                  {transaction.tags && transaction.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2.5">
                      {transaction.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-white/[0.03] border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-[0.05em] rounded-full hover:border-[#e8b84b]/40 hover:text-[#e8b84b] transition-all cursor-default"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Operations */}
              <div>
                <h3 className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e8b84b]" />
                  Operations ({transaction.operation_count})
                </h3>
                <div className="space-y-4">
                  {transaction.operations.map((op) => (
                    <div
                      key={op.id}
                      className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/15 transition-all group/op"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`p-2.5 rounded-xl border ${
                              op.type === "payment"
                                ? "bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20"
                                : op.type === "create_account"
                                  ? "bg-[#4aa9e8]/10 text-[#4aa9e8] border-[#4aa9e8]/20"
                                  : "bg-white/5 text-white/50 border-white/10"
                            }`}
                          >
                            {op.type === "payment" ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <Hash className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <span className="text-sm font-bold capitalize text-white group-hover/op:text-[#e8b84b] transition-colors">
                              {op.type.replace(/_/g, " ")}
                            </span>
                            <p className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-wider mt-0.5">
                              Operation ID: {op.id.substring(0, 8)}
                            </p>
                          </div>
                        </div>
                        {op.amount && (
                          <div className="text-right">
                            <span className="text-sm font-black text-white">
                              {op.amount}
                            </span>
                            <span className="text-[10px] font-bold text-[#e8b84b] ml-1.5">
                              {op.asset_code || "XLM"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 border-t border-white/5 pt-3">
                        {op.from && (
                          <p className="text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between">
                            <span className="uppercase tracking-widest font-bold opacity-70">
                              From
                            </span>
                            <span className="font-mono text-[#e8edf8]">
                              {formatAddress(op.from)}
                            </span>
                          </p>
                        )}
                        {op.to && (
                          <p className="text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between">
                            <span className="uppercase tracking-widest font-bold opacity-70">
                              To
                            </span>
                            <span className="font-mono text-[#e8edf8]">
                              {formatAddress(op.to)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/5 bg-white/[0.01] backdrop-blur-md flex gap-3">
              <a
                href={horizonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-3 flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] text-sm font-bold rounded-2xl shadow-xl shadow-[#e8b84b]/10 transition-all hover:-translate-y-0.5 active:scale-[0.98] uppercase tracking-wider"
              >
                <ExternalLink className="w-4 h-4" />
                Explore on Horizon
              </a>
              <button
                onClick={exportJson}
                className="flex-1 px-4 py-3.5 bg-white/5 border border-white/10 text-white/80 text-sm font-bold rounded-2xl hover:bg-white/[0.08] hover:border-white/20 transition-all flex items-center justify-center gap-2 active:scale-95 group"
                title="Export JSON"
              >
                <Download className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
                <span className="hidden sm:inline uppercase tracking-wider">
                  JSON
                </span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
