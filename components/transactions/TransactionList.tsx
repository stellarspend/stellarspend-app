"use client";

import React, { useEffect, useCallback, useState } from "react";
import {
  fetchTransactions,
  Transaction,
  FilterParams,
  PaginatedResponse,
} from "@/lib/api/client";
import TransactionItem from "./TransactionItem";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TransactionListProps {
  filters: FilterParams;
  onOpenDrawer: (tx: Transaction) => void;
}

const TRANSACTIONS_PER_PAGE = 10;

export default function TransactionList({
  filters,
  onOpenDrawer,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / TRANSACTIONS_PER_PAGE));

  // Load transactions
  const loadTransactions = useCallback(
    async (pageNum: number) => {
      try {
        setLoading(true);
        const response: PaginatedResponse<Transaction> =
          await fetchTransactions(filters, pageNum, TRANSACTIONS_PER_PAGE);

        setTransactions(response.data);
        setTotal(response.total);
        setHasMore(response.hasMore);
        setPage(response.page);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  // Reset pagination when filters change so search/filter results start at page 1.
  useEffect(() => {
    setTransactions([]);
    setTotal(0);
    setHasMore(true);
    loadTransactions(1);
  }, [filters, loadTransactions]);

  const handlePreviousPage = () => {
    if (page > 1 && !loading) {
      loadTransactions(page - 1);
    }
  };

  const handleNextPage = () => {
    if (hasMore && !loading) {
      loadTransactions(page + 1);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="bg-white/[0.01] backdrop-blur-sm rounded-3xl border border-white/5 shadow-2xl shadow-black/50">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Operation
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Context
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Impact
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Timeframe
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em] text-right">
                  Review
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.05]" />
                      <div className="space-y-2">
                        <div className="w-24 h-4 bg-white/[0.05] rounded" />
                        <div className="w-20 h-3 bg-white/[0.03] rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-white/[0.05] rounded" />
                      <div className="w-48 h-3 bg-white/[0.03] rounded" />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="w-20 h-4 bg-white/[0.05] rounded" />
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-2">
                      <div className="w-16 h-4 bg-white/[0.05] rounded" />
                      <div className="w-16 h-3 bg-white/[0.03] rounded" />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="w-10 h-10 bg-white/[0.05] rounded-xl ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 flex flex-col items-center">
        <div className="w-1 h-12 bg-linear-to-b from-[#e8b84b]/20 to-transparent mb-6" />
        <p className="text-[#7a8aaa] text-[10px] font-bold uppercase tracking-[0.3em]">
          No transactions found
        </p>
        <p className="text-[#7a8aaa]/60 text-xs mt-2">
          Try adjusting your filters or search query
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/[0.01] backdrop-blur-sm rounded-3xl border border-white/5 shadow-2xl shadow-black/50">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Operation
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Context
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Impact
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em]">
                  Timeframe
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.2em] text-right">
                  Review
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {transactions.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onOpenDrawer={onOpenDrawer}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[#7a8aaa] sm:text-left">
          Page {page} of {totalPages}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handlePreviousPage}
            disabled={page === 1 || loading}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#e8edf8] transition-all hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>
          <button
            onClick={handleNextPage}
            disabled={!hasMore || loading}
            className="flex items-center gap-2 rounded-2xl bg-[#e8b84b] px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#1a0f00] transition-all hover:bg-[#f0c85a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </>
  );
}
