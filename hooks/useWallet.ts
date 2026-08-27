"use client";

/**
 * hooks/useWallet.ts
 *
 * Combines wallet context (multi-wallet management, selection, balance refresh)
 * with a wallet-provider abstraction supporting Freighter, Ledger, xBull, and
 * Albedo.  Provides a single hook for connecting/disconnecting any supported
 * wallet, formatting addresses, and aggregating balances across all managed
 * wallets.
 */

import { useCallback, useState, useRef } from "react";
import { useWalletContext, Wallet } from "@/context/WalletContext";
import {
  getProvider,
  type WalletProvider,
  type WalletProviderId,
} from "@/lib/wallet-providers";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WalletProviderState {
  /** The provider currently connected (if any). */
  providerId: WalletProviderId | null;
  isInstalled: boolean;
  isConnected: boolean;
  publicKey: string | null;
  isConnecting: boolean;
  /** Named walletError to avoid clash with wallet context `error`. */
  walletError: string | null;
}

export interface UseWalletReturn {
  // Wallet context state
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  isLoading: boolean;
  error: string | null;
  addWallet: (wallet: Omit<Wallet, "id" | "createdAt">) => void;
  removeWallet: (id: string) => void;
  selectWallet: (id: string) => void;
  updateWalletBalance: (id: string, balance: Wallet["balance"]) => void;
  updateWalletName: (id: string, name: string) => void;
  setDefaultWallet: (id: string) => void;
  refreshBalances: () => Promise<void>;
  // Wallet-provider state (generalised)
  walletProvider: WalletProviderState;
  connectProvider: (providerId?: WalletProviderId) => Promise<void>;
  disconnectProvider: () => void;
  /** Get the underlying WalletProvider instance (e.g. for direct signing). */
  getActiveProvider: () => WalletProvider | null;
  // ── Legacy helpers (preserved for backward compat) ──
  freighter: WalletProviderState;
  connectFreighter: () => Promise<void>;
  disconnectFreighter: () => void;
  // Helpers
  getWalletById: (id: string) => Wallet | undefined;
  getWalletByAddress: (address: string) => Wallet | undefined;
  formatAddress: (address: string, start?: number, end?: number) => string;
  getTotalBalance: () => { xlm: string; usdc: string; eurc: string };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Provides combined wallet management and Freighter extension integration.
 * Wraps the WalletContext for multi-wallet CRUD and adds Freighter connect/disconnect,
 * address formatting, and cross-wallet balance aggregation.
 * @returns A UseWalletReturn object with wallet state, Freighter state, and helper functions.
 */
export function useWallet(): UseWalletReturn {
  const context = useWalletContext();

  const [providerState, setProviderState] = useState<WalletProviderState>({
    providerId: null,
    isInstalled: false,
    isConnected: false,
    publicKey: null,
    isConnecting: false,
    walletError: null,
  });

  // Keep a reference to the active provider for direct access (e.g. signing).
  const activeProviderRef = useRef<WalletProvider | null>(null);

  // ── Generic connect ───────────────────────────────────────────────────────

  const connectProvider = useCallback(
    async (providerId: WalletProviderId = "freighter") => {
      const provider = getProvider(providerId);
      const installed = await provider.isAvailable().catch(() => false);

      if (!installed && provider.getMeta().kind !== "web") {
        setProviderState({
          providerId,
          isInstalled: false,
          isConnected: false,
          publicKey: null,
          isConnecting: false,
          walletError: `${provider.getMeta().name} not found. Install it to continue.`,
        });
        return;
      }

      setProviderState({
        providerId,
        isInstalled: installed,
        isConnected: false,
        publicKey: null,
        isConnecting: true,
        walletError: null,
      });

      try {
        const publicKey = await provider.connect();
        if (!publicKey) throw new Error("No public key returned.");

        activeProviderRef.current = provider;

        setProviderState({
          providerId,
          isInstalled: true,
          isConnected: true,
          publicKey,
          isConnecting: false,
          walletError: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to connect wallet.";
        setProviderState({
          providerId,
          isInstalled: installed,
          isConnected: false,
          publicKey: null,
          isConnecting: false,
          walletError: message,
        });
      }
    },
    [],
  );

  const disconnectProvider = useCallback(() => {
    activeProviderRef.current?.disconnect();
    activeProviderRef.current = null;
    setProviderState({
      providerId: null,
      isInstalled: false,
      isConnected: false,
      publicKey: null,
      isConnecting: false,
      walletError: null,
    });
  }, []);

  const getActiveProvider = useCallback(() => activeProviderRef.current, []);

  // ── Legacy Freighter helpers (delegate to generic connect) ────────────────

  const connectFreighter = useCallback(
    () => connectProvider("freighter"),
    [connectProvider],
  );

  const disconnectFreighter = useCallback(
    () => disconnectProvider(),
    [disconnectProvider],
  );

  const getWalletById = useCallback(
    (id: string) => context.wallets.find((w) => w.id === id),
    [context.wallets]
  );

  const getWalletByAddress = useCallback(
    (address: string) =>
      context.wallets.find(
        (w) => w.address.toLowerCase() === address.toLowerCase()
      ),
    [context.wallets]
  );

  const formatAddress = useCallback(
    (address: string, start = 4, end = 4): string => {
      if (address.length <= start + end) return address;
      return `${address.slice(0, start)}...${address.slice(-end)}`;
    },
    []
  );

  const getTotalBalance = useCallback(() => {
    return context.wallets.reduce(
      (acc, w) => ({
        xlm: (parseFloat(acc.xlm) + (parseFloat(w.balance.xlm) || 0)).toFixed(2),
        usdc: (parseFloat(acc.usdc) + (parseFloat(w.balance.usdc || "0") || 0)).toFixed(2),
        eurc: (parseFloat(acc.eurc) + (parseFloat(w.balance.eurc || "0") || 0)).toFixed(2),
      }),
      { xlm: "0.00", usdc: "0.00", eurc: "0.00" }
    );
  }, [context.wallets]);

  return {
    wallets: context.wallets,
    selectedWallet: context.selectedWallet,
    isLoading: context.isLoading,
    error: context.error,
    addWallet: context.addWallet,
    removeWallet: context.removeWallet,
    selectWallet: context.selectWallet,
    updateWalletBalance: context.updateWalletBalance,
    updateWalletName: context.updateWalletName,
    setDefaultWallet: context.setDefaultWallet,
    refreshBalances: context.refreshBalances,
    // New generic provider state
    walletProvider: providerState,
    connectProvider,
    disconnectProvider,
    getActiveProvider,
    // Legacy aliases
    freighter: providerState,
    connectFreighter,
    disconnectFreighter,
    getWalletById,
    getWalletByAddress,
    formatAddress,
    getTotalBalance,
  };
}

export default useWallet;