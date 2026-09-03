"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import {
  fetchTransactions,
  Transaction,
  FilterParams,
  PaginatedResponse,
} from "@/lib/api/client";
import {
  PAYMENT_CONFIRMED_EVENT,
  PAYMENT_SUBMITTED_EVENT,
  toTransactionRecord,
  type PendingPayment,
  type SubmittedPayment,
} from "@/lib/stellar/submitTransaction";
import TransactionItem from "./TransactionItem";
import { ChevronLeft, ChevronRight, Search, Download } from "lucide-react";

const PAGE_SIZE = 10;

interface TransactionListProps {
  filters: FilterParams;
  onOpenDrawer: (tx: Transaction) => void;
  categoryMap?: Record<string, string>;
}

export default function TransactionList({
  filters,
  onOpenDrawer,
  categoryMap = {},
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const livePaymentStatus = useRef(new Map<string, "pending" | "confirmed">());
  const knownTransactionHashes = useRef(new Set<string>());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handlePaymentSubmitted = (event: Event) => {
      const payment = (event as CustomEvent<PendingPayment>).detail;
      if (!payment || livePaymentStatus.current.has(payment.hash)) return;
      livePaymentStatus.current.set(payment.hash, "pending");
      const wasKnown = knownTransactionHashes.current.has(payment.hash);
      knownTransactionHashes.current.add(payment.hash);
      const transaction = toTransactionRecord(payment, "pending");
      setTransactions((current) => {
        if (current.some((item) => item.hash === transaction.hash)) return current;
        return [transaction, ...current];
      });
      if (!wasKnown) setTotal((total) => total + 1);
    };

    const handlePaymentConfirmed = (event: Event) => {
      const payment = (event as CustomEvent<SubmittedPayment>).detail;
      if (!payment || livePaymentStatus.current.get(payment.hash) === "confirmed") return;
      livePaymentStatus.current.set(payment.hash, "confirmed");
      const wasKnown = knownTransactionHashes.current.has(payment.hash);
      knownTransactionHashes.current.add(payment.hash);
      const transaction = toTransactionRecord(payment, "confirmed");
      setTransactions((current) => [
        transaction,
        ...current.filter((item) => item.hash !== transaction.hash),
      ]);
      if (!wasKnown) setTotal((total) => total + 1);
    };

    window.addEventListener(PAYMENT_SUBMITTED_EVENT, handlePaymentSubmitted);
    window.addEventListener(PAYMENT_CONFIRMED_EVENT, handlePaymentConfirmed);
    return () => {
      window.removeEventListener(PAYMENT_SUBMITTED_EVENT, handlePaymentSubmitted);
      window.removeEventListener(PAYMENT_CONFIRMED_EVENT, handlePaymentConfirmed);
    };
  }, []);

  const activeFilters = useMemo<FilterParams>(
    () => ({
      ...filters,
      search: debouncedSearch || undefined,
    }),
    [filters, debouncedSearch],
  );

  const prevFiltersRef = useRef(activeFilters);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadTransactions = useCallback(
    async (pageNum: number) => {
      try {
        setLoading(true);
        const response: PaginatedResponse<Transaction> =
          await fetchTransactions(activeFilters, pageNum, PAGE_SIZE);

        response.data.forEach((transaction) => {
          knownTransactionHashes.current.add(transaction.hash);
        });
        setTransactions(response.data);
        setTotal(response.total);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    },
    [activeFilters],
  );

  const exportToCSV = useCallback(async () => {
    try {
      // Fetch all transactions for export (up to a reasonable limit)
      const response: PaginatedResponse<Transaction> =
        await fetchTransactions(activeFilters, 1, 1000);

      const allTransactions = response.data;

      if (allTransactions.length === 0) {
        alert("No transactions to export.");
        return;
      }

      // CSV headers
      const headers = ["Date", "Description", "Amount", "Type", "Status"];

      // Format transactions for CSV
      const rows = allTransactions.map((tx) => {
        const operation = tx.operations[0];
        const date = new Date(tx.created_at).toISOString().split("T")[0];
        const description = (tx.memo || "").replace(/"/g, '""');
        const amount = operation?.amount || "0";
        const type = operation?.type || "unknown";
        const status = tx.successful ? "completed" : "failed";

        return [
          date,
          `"${description}"`,
          amount,
          type,
          status,
        ].join(",");
      });

      // Combine headers and rows
      const csvContent = [headers.join(","), ...rows].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Generate filename with current date
      const today = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `transactions-${today}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export transactions:", error);
      alert("Failed to export transactions. Please try again.");
    }
  }, [activeFilters]);

  useEffect(() => {
    const filtersChanged =
      JSON.stringify(prevFiltersRef.current) !== JSON.stringify(activeFilters);
    prevFiltersRef.current = activeFilters;

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    loadTransactions(page);
  }, [activeFilters, page, loadTransactions]);

  const handlePrevious = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNext = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };

  const searchInput = (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <label
          htmlFor="transaction-search"
          className="text-[10px] font-black text-[#7a8aaa] uppercase tracking-[0.3em]"
        >
          Search transactions
        </label>
        <button
          type="button"
          onClick={exportToCSV}
          disabled={loading || transactions.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e8b84b]/30 bg-[#e8b84b]/10 text-[#e8b84b] text-xs font-bold uppercase tracking-wider hover:bg-[#e8b84b]/20 hover:border-[#e8b84b]/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e8b84b]/10 disabled:hover:border-[#e8b84b]/30"
          aria-label="Export transactions to CSV"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 shadow-inner shadow-black/20">
        <Search className="w-4 h-4 text-[#7a8aaa]" />
        <input
          id="transaction-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search description, amount, or date"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#7a8aaa]/70"
        />
      </div>
    </div>
  );

  if (loading && transactions.length === 0) {
    return (
      <div>
        {searchInput}
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
      </div>
    );
  }

  if (!loading && transactions.length === 0) {
    return (
      <div>
        {searchInput}
        <div className="text-center py-16 flex flex-col items-center">
          <div className="w-1 h-12 bg-linear-to-b from-[#e8b84b]/20 to-transparent mb-6" />
          <p className="text-[#7a8aaa] text-[10px] font-bold uppercase tracking-[0.3em]">
            No results found
          </p>
          <p className="text-[#7a8aaa]/60 text-xs mt-2">
            Try adjusting your filters or search query
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {searchInput}
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
              {loading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
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
                  ))
                : transactions.map((tx) => (
                    <TransactionItem
                      key={tx.id}
                      transaction={tx}
                      onOpenDrawer={onOpenDrawer}
                      category={categoryMap[tx.id]}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 py-8">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={page === 1 || loading}
          className="text-[#e8b84b] font-black text-xs uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#e8b84b]"
        >
          <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
          Previous
        </button>

        <p className="text-[#7a8aaa] text-[10px] font-bold uppercase tracking-[0.3em]">
          Page {page} of {totalPages}
        </p>

        <button
          type="button"
          onClick={handleNext}
          disabled={page >= totalPages || loading}
          className="text-[#e8b84b] font-black text-xs uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#e8b84b]"
        >
          Next
          <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
