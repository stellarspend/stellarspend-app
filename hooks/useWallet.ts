"use client";

/**
 * hooks/useWallet.ts
 *
 * Combines wallet context (multi-wallet management, selection, balance refresh)
 * with Freighter browser extension integration. Provides a single hook for
 * connecting/disconnecting Freighter, formatting addresses, and aggregating
 * balances across all managed wallets.
 */

import { useCallback, useState } from "react";
import { useWalletContext, Wallet } from "@/context/WalletContext";

// ── Freighter browser extension type declaration ──────────────────────────────
declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      requestAccess: () => Promise<string>;
      signTransaction: (xdr: string, network: string) => Promise<string>;
    };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FreighterState {
  isInstalled: boolean;
  isConnected: boolean;
  publicKey: string | null;
  isConnecting: boolean;
  freighterError: string | null; // named freighterError to avoid clash with wallet context `error`
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
  // Freighter
  freighter: FreighterState;
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

  const [freighterState, setFreighterState] = useState<FreighterState>({
    isInstalled: false,
    isConnected: false,
    publicKey: null,
    isConnecting: false,
    freighterError: null,
  });

  const connectFreighter = useCallback(async () => {
    const installed = typeof window !== "undefined" && !!window.freighter;

    if (!installed) {
      setFreighterState((s) => ({
        ...s,
        isInstalled: false,
        freighterError: "Freighter not found. Install the extension to continue.",
      }));
      window.open("https://freighter.app", "_blank", "noopener,noreferrer");
      return;
    }

    setFreighterState((s) => ({
      ...s,
      isInstalled: true,
      isConnecting: true,
      freighterError: null,
    }));

    try {
      const publicKey = await window.freighter!.requestAccess();
      if (!publicKey) throw new Error("No public key returned.");

      setFreighterState((s) => ({
        ...s,
        isConnected: true,
        publicKey,
        isConnecting: false,
        freighterError: null,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect Freighter.";
      setFreighterState((s) => ({
        ...s,
        isConnected: false,
        publicKey: null,
        isConnecting: false,
        freighterError: message,
      }));
    }
  }, []);

  const disconnectFreighter = useCallback(() => {
    setFreighterState((s) => ({
      ...s,
      isConnected: false,
      publicKey: null,
      freighterError: null,
    }));
  }, []);

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
    freighter: freighterState,
    connectFreighter,
    disconnectFreighter,
    getWalletById,
    getWalletByAddress,
    formatAddress,
    getTotalBalance,
  };
}

export default useWallet;