"use client";

/**
 * components/wallet/WalletProviderPicker.tsx
 *
 * Modal / drawer that lets users choose which wallet provider to connect
 * with.  Shows availability status, kind badges, and handles the
 * connection flow.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Usb, Globe, Puzzle, Loader2, Check } from "lucide-react";
import {
  getProviderMetaList,
  getProvider,
} from "@/lib/wallet-providers";
import type { WalletProviderId, WalletProviderMeta } from "@/lib/wallet-providers";

interface WalletProviderPickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the public key after a successful connection. */
  onConnected: (publicKey: string, providerId: WalletProviderId) => void;
  /** Currently connected provider, if any. */
  connectedProviderId?: WalletProviderId | null;
}

const kindIcons: Record<WalletProviderMeta["kind"], React.ReactNode> = {
  hardware: <Usb className="w-4 h-4" />,
  extension: <Puzzle className="w-4 h-4" />,
  web: <Globe className="w-4 h-4" />,
};

const kindLabels: Record<WalletProviderMeta["kind"], string> = {
  hardware: "Hardware",
  extension: "Extension",
  web: "Web Wallet",
};

export default function WalletProviderPicker({
  open,
  onClose,
  onConnected,
  connectedProviderId,
}: WalletProviderPickerProps) {
  const [providers, setProviders] = useState<WalletProviderMeta[]>([]);
  const [loadingId, setLoadingId] = useState<WalletProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    getProviderMetaList().then((list) => {
      if (!cancelled) {
        setProviders(list);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleConnect = async (providerId: WalletProviderId) => {
    setError(null);
    setLoadingId(providerId);

    try {
      const provider = getProvider(providerId);
      const publicKey = await provider.connect();
      onConnected(publicKey, providerId);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connection failed. Please try again.",
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-[#0d1221] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
                <p className="text-xs text-[#7a8aaa] mt-0.5">
                  Choose a wallet provider to continue
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-4 h-4 text-[#7a8aaa]" />
              </button>
            </div>

            {/* Provider list */}
            <div className="p-4 space-y-2">
              {providers.map((p) => {
                const isLoading = loadingId === p.id;
                const isConnected = connectedProviderId === p.id;

                return (
                  <button
                    key={p.id}
                    onClick={() => handleConnect(p.id)}
                    disabled={isLoading}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      isConnected
                        ? "border-[#e8b84b]/30 bg-[#e8b84b]/[0.08]"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                    } ${isLoading ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                  >
                    {/* Kind badge */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isConnected
                          ? "bg-[#e8b84b]/15 text-[#e8b84b]"
                          : "bg-white/5 text-[#7a8aaa]"
                      }`}
                    >
                      {kindIcons[p.kind]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-medium text-[#7a8aaa] bg-white/5 px-1.5 py-0.5 rounded">
                          {kindLabels[p.kind]}
                        </span>
                      </div>
                      <p className="text-xs text-[#7a8aaa] mt-0.5 truncate">
                        {p.description}
                      </p>
                    </div>

                    {/* Status / action */}
                    <div className="shrink-0">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 text-[#e8b84b] animate-spin" />
                      ) : isConnected ? (
                        <div className="flex items-center gap-1.5 text-[#e8b84b]">
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-medium">Connected</span>
                        </div>
                      ) : !p.isAvailable && p.kind !== "web" ? (
                        <span className="text-xs text-[#7a8aaa]">Not detected</span>
                      ) : (
                        <span className="text-xs font-medium text-[#e8b84b]">
                          Connect
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <div className="px-6 pb-4">
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {error}
                </div>
              </div>
            )}

            {/* Security note */}
            <div className="px-6 pb-4">
              <p className="text-[10px] text-[#7a8aaa] text-center leading-relaxed">
                Your keys never leave your device. This app only requests
                permission to view your public key and request transaction
                signatures.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
