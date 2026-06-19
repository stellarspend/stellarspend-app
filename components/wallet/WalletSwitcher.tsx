"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Wallet,
  Plus,
  Trash2,
  Star,
  RefreshCw,
  Check,
  X,
  Edit2,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

interface WalletSwitcherProps {
  className?: string;
  showBalance?: boolean;
  variant?: "default" | "compact" | "minimal";
}

export default function WalletSwitcher({
  className = "",
  showBalance = true,
  variant = "default",
}: WalletSwitcherProps) {
  const {
    wallets,
    selectedWallet,
    isLoading,
    selectWallet,
    removeWallet,
    setDefaultWallet,
    updateWalletName,
    refreshBalances,
    formatAddress,
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const walletOptionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const listboxId = "wallet-switcher-listbox";
  const selectedWalletIndex = wallets.findIndex((wallet) => wallet.id === selectedWallet?.id);
  const initialWalletIndex = selectedWalletIndex >= 0 ? selectedWalletIndex : 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsAdding(false);
        setEditingId(null);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    if (isOpen && !isAdding && !editingId) {
      walletOptionRefs.current[activeWalletIndex]?.focus();
    }
  }, [activeWalletIndex, editingId, isAdding, isOpen]);

  const closeDropdown = () => {
    setIsOpen(false);
    setIsAdding(false);
    setEditingId(null);
  };

  const openDropdown = (activeIndex = initialWalletIndex) => {
    setActiveWalletIndex(activeIndex);
    setIsOpen(true);
  };

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
      return;
    }

    openDropdown();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDropdown();
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown(0);
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  };

  const handleWalletKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    index: number,
    id: string,
  ) => {
    if (e.target !== e.currentTarget) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveWalletIndex((index + 1) % wallets.length);
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveWalletIndex((index - 1 + wallets.length) % wallets.length);
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(id);
      triggerRef.current?.focus();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      triggerRef.current?.focus();
    }
  };

  const handleSelect = (id: string) => {
    selectWallet(id);
    closeDropdown();
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (wallets.length <= 1) {
      alert("You must have at least one wallet");
      return;
    }
    if (confirm("Are you sure you want to remove this wallet?")) {
      removeWallet(id);
    }
  };

  const handleSetDefault = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDefaultWallet(id);
  };

  const startEditing = (e: React.MouseEvent, wallet: { id: string; name: string }) => {
    e.stopPropagation();
    setEditingId(wallet.id);
    setEditName(wallet.name);
  };

  const saveEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editName.trim()) {
      updateWalletName(id, editName.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditName("");
  };

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim() || !newWalletAddress.trim()) return;

    // Simple validation for Stellar address format
    if (!newWalletAddress.startsWith("G") || newWalletAddress.length !== 56) {
      alert("Please enter a valid Stellar public key (starts with G, 56 characters)");
      return;
    }

    // Add wallet logic would go here - for now we'll use mock data
    // In a real implementation, this would call addWallet with proper data
    alert("Wallet added successfully! (Demo mode - wallet data is mocked)");
    setNewWalletName("");
    setNewWalletAddress("");
    setIsAdding(false);
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await refreshBalances();
  };

  if (variant === "minimal") {
    return (
      <button
        ref={triggerRef}
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label="Select wallet"
      >
        <Wallet className="w-4 h-4 text-[#e8b84b]" />
        <span className="text-sm text-white font-medium">
          {selectedWallet ? formatAddress(selectedWallet.address) : "Select Wallet"}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#7a8aaa] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
        disabled={isLoading}
        className={`flex items-center gap-3 w-full text-left transition-all ${
          variant === "compact"
            ? "px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
            : "p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label="Select wallet"
      >
        <div className={`rounded-xl bg-[#e8b84b]/10 flex items-center justify-center ${variant === "compact" ? "w-8 h-8" : "w-12 h-12"}`}>
          <Wallet className={`text-[#e8b84b] ${variant === "compact" ? "w-4 h-4" : "w-6 h-6"}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          {selectedWallet ? (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-white font-semibold truncate ${variant === "compact" ? "text-sm" : "text-base"}`}>
                  {selectedWallet.name}
                </span>
                {selectedWallet.isDefault && (
                  <Star className="w-3 h-3 text-[#e8b84b] fill-[#e8b84b]" />
                )}
              </div>
              {showBalance && (
                <p className={`text-[#7a8aaa] truncate ${variant === "compact" ? "text-[10px]" : "text-xs"}`}>
                  {formatAddress(selectedWallet.address)} • {selectedWallet.balance.xlm} XLM
                </p>
              )}
            </>
          ) : (
            <span className="text-[#7a8aaa]">Select a wallet</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="w-4 h-4 text-[#7a8aaa] animate-spin" />}
          <ChevronDown className={`w-5 h-5 text-[#7a8aaa] transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <div className="bg-[#0d1221] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-[#7a8aaa] uppercase tracking-wider">
                  Linked Wallets ({wallets.length})
                </span>
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  title="Refresh balances"
                >
                  <RefreshCw className={`w-4 h-4 text-[#7a8aaa] ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Wallet List */}
              <div
                id={listboxId}
                role="listbox"
                aria-label="Linked wallets"
                className="max-h-80 overflow-y-auto"
              >
                {wallets.map((wallet, index) => (
                  <div
                    key={wallet.id}
                    ref={(node) => {
                      walletOptionRefs.current[index] = node;
                    }}
                    onClick={() => handleSelect(wallet.id)}
                    onFocus={() => setActiveWalletIndex(index)}
                    onKeyDown={(e) => handleWalletKeyDown(e, index, wallet.id)}
                    role="option"
                    aria-selected={selectedWallet?.id === wallet.id}
                    tabIndex={activeWalletIndex === index ? 0 : -1}
                    className={`group px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/40 ${
                      selectedWallet?.id === wallet.id ? "bg-[#e8b84b]/5" : ""
                    }`}
                  >
                    {/* Selection indicator */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedWallet?.id === wallet.id
                        ? "border-[#e8b84b] bg-[#e8b84b]"
                        : "border-white/20"
                    }`}>
                      {selectedWallet?.id === wallet.id && (
                        <Check className="w-3 h-3 text-[#1a0f00]" />
                      )}
                    </div>

                    {/* Wallet info */}
                    <div className="flex-1 min-w-0">
                      {editingId === wallet.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-[#e8b84b]"
                            autoFocus
                          />
                          <button
                            onClick={(e) => saveEdit(e, wallet.id)}
                            className="p-1 hover:bg-green-500/20 rounded text-green-400"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              {wallet.name}
                            </span>
                            {wallet.isDefault && (
                              <Star className="w-3 h-3 text-[#e8b84b] fill-[#e8b84b]" />
                            )}
                          </div>
                          <p className="text-xs text-[#7a8aaa]">
                            {formatAddress(wallet.address)} • {wallet.balance.xlm} XLM
                          </p>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {editingId !== wallet.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startEditing(e, wallet)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-[#7a8aaa] hover:text-white transition-colors"
                          title="Edit name"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!wallet.isDefault && (
                          <button
                            onClick={(e) => handleSetDefault(e, wallet.id)}
                            className="p-1.5 hover:bg-[#e8b84b]/20 rounded-lg text-[#7a8aaa] hover:text-[#e8b84b] transition-colors"
                            title="Set as default"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleRemove(e, wallet.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg text-[#7a8aaa] hover:text-red-400 transition-colors"
                          title="Remove wallet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Wallet Section */}
              {isAdding ? (
                <form onSubmit={handleAddWallet} className="p-4 border-t border-white/5 bg-white/[0.02]">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#7a8aaa] uppercase tracking-wider">Wallet Name</label>
                      <input
                        type="text"
                        value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                        placeholder="e.g., My Savings"
                        className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-[#e8b84b]"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#7a8aaa] uppercase tracking-wider">Public Key</label>
                      <input
                        type="text"
                        value={newWalletAddress}
                        onChange={(e) => setNewWalletAddress(e.target.value)}
                        placeholder="G..."
                        className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-[#e8b84b]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] text-sm font-semibold rounded-xl transition-colors"
                      >
                        Add Wallet
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full px-4 py-3 flex items-center gap-2 text-[#e8b84b] hover:bg-[#e8b84b]/10 transition-colors border-t border-white/5"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add New Wallet</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
