"use client";

import React, { useState } from "react";
import TransactionDrawer from "@/components/transactions/TransactionDrawer";
import TransactionList from "@/components/transactions/TransactionList";
import CustomSelect from "@/components/ui/CustomSelect";
import { Search, Filter, RefreshCw } from "lucide-react";
import { Transaction, FilterParams } from "@/lib/api/client";
import SendPaymentModal from "@/components/transactions/SendPaymentModal";
import { AnimatePresence } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { setCategory } from "@/lib/stellar/categoriesContract";
import { triggerNotification } from "@/lib/stellar/budgetContract";


export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const { freighter } = useWallet();

  // Filter state
  const [filters, setFilters] = useState<FilterParams>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("all");
  const [selectedType, setSelectedType] = useState<"in" | "out" | "all">("all");

  const handleOpenDrawer = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsDrawerOpen(true);
  };

  const handleCategoryLoaded = (transactionId: string, category: string | null) => {
    if (!category) return;
    setCategoryMap((prev) =>
      prev[transactionId] === category ? prev : { ...prev, [transactionId]: category },
    );
  };

  const handleCategoryChange = async (transactionId: string, category: string) => {
    const publicKey = freighter.publicKey;
    if (!publicKey) {
      triggerNotification("error", "Connect your wallet to assign a category.");
      return;
    }

    const previousCategory = categoryMap[transactionId];

    // Optimistic UI: show the new badge immediately.
    setCategoryMap((prev) => ({ ...prev, [transactionId]: category }));

    try {
      await setCategory(publicKey, transactionId, category);
    } catch (error) {
      // setCategory already surfaces an error toast; just roll back the badge.
      console.error("Failed to set transaction category", error);
      setCategoryMap((prev) => {
        const next = { ...prev };
        if (previousCategory) {
          next[transactionId] = previousCategory;
        } else {
          delete next[transactionId];
        }
        return next;
      });
    }
  };

  const applyFilters = () => {
    const newFilters: FilterParams = {};

    if (searchTerm.trim()) {
      newFilters.search = searchTerm.trim();
    }

    if (dateFrom) {
      newFilters.dateFrom = dateFrom;
    }

    if (dateTo) {
      newFilters.dateTo = dateTo;
    }

    if (selectedAsset !== "all") {
      newFilters.asset = selectedAsset;
    }

    if (selectedType !== "all") {
      newFilters.type = selectedType;
    }

    setFilters(newFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setSelectedAsset("all");
    setSelectedType("all");
    setFilters({});
  };

  const hasActiveFilters =
    searchTerm ||
    dateFrom ||
    dateTo ||
    selectedAsset !== "all" ||
    selectedType !== "all";

  return (
    <div className="min-h-screen bg-[#080b18] p-4 md:p-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#e8b84b]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[#4aa9e8]/5 blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-[#e8b84b]/20 bg-[#e8b84b]/[0.08] text-[#e8b84b]">
              <div className="w-1 h-1 rounded-full bg-[#e8b84b] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                Blockchain Activity
              </span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              Transactions
            </h1>
            <p className="text-[#7a8aaa] mt-2 font-medium max-w-md">
              A comprehensive history of your operations on the Stellar network.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.08] hover:border-white/20 transition-all active:scale-95 group">
              <RefreshCw className="w-5 h-5 text-[#7a8aaa] group-hover:text-white transition-colors" />
            </button>
            <button
              onClick={() => setIsSendModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-2xl shadow-xl shadow-[#e8b84b]/10 transition-all hover:-translate-y-0.5 active:scale-[0.98] uppercase tracking-wider text-sm"
            >
              Send Assets
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="relative z-50 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8aaa] group-focus-within:text-[#e8b84b] transition-colors" />
              <input
                type="text"
                placeholder="Search by hash, memo or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyFilters();
                  }
                }}
                className="w-full pl-12 pr-4 py-3.5 bg-white/[0.02] border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/50 text-white placeholder-[#7a8aaa]/50 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all uppercase tracking-widest text-[10px] ${
                showFilters
                  ? "bg-[#e8b84b]/10 border border-[#e8b84b]/30 text-[#e8b84b]"
                  : "bg-white/[0.02] border border-white/10 text-[#e8edf8] hover:bg-white/[0.08] hover:border-white/20"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters{" "}
              {hasActiveFilters && <span className="ml-1 text-xs">•</span>}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="relative z-50 bg-white/[0.01] backdrop-blur-sm rounded-2xl border border-white/5 p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#7a8aaa] uppercase tracking-widest mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/50 text-white outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7a8aaa] uppercase tracking-widest mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/50 text-white outline-none transition-all"
                  />
                </div>
              </div>

              {/* Asset & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#7a8aaa] uppercase tracking-widest mb-2">
                    Asset
                  </label>
                  <CustomSelect
                    value={selectedAsset}
                    onChange={setSelectedAsset}
                    options={[
                      { value: "all", label: "All Assets" },
                      { value: "XLM", label: "Stellar Lumens (XLM)" },
                      { value: "USDC", label: "USD Coin (USDC)" },
                      { value: "EURC", label: "Euro Coin (EURC)" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7a8aaa] uppercase tracking-widest mb-2">
                    Type
                  </label>
                  <CustomSelect
                    value={selectedType}
                    onChange={(val) =>
                      setSelectedType(val as "in" | "out" | "all")
                    }
                    options={[
                      { value: "all", label: "All Types" },
                      { value: "in", label: "Incoming" },
                      { value: "out", label: "Outgoing" },
                    ]}
                  />
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={applyFilters}
                  className="flex-1 px-4 py-2.5 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-xl transition-all uppercase tracking-wider text-xs"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2.5 bg-white/[0.02] border border-white/10 hover:bg-white/[0.08] text-[#e8edf8] font-bold rounded-xl transition-all uppercase tracking-wider text-xs"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transaction List with pagination */}
        <TransactionList
          filters={filters}
          onOpenDrawer={handleOpenDrawer}
          categoryMap={categoryMap}
        />
      </div>

      <TransactionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        transaction={selectedTx}
        category={selectedTx ? categoryMap[selectedTx.id] : undefined}
        onCategoryChange={handleCategoryChange}
        onCategoryLoaded={handleCategoryLoaded}
      />

      <AnimatePresence>
        {isSendModalOpen && (
          <SendPaymentModal onClose={() => setIsSendModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
