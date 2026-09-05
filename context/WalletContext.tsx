"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  saveEncrypted,
  loadEncrypted,
  loadPlaintext,
  migrateToEncrypted,
  detectPlaintextData,
  isPassphraseSet,
  setPassphraseSet,
  resetEncryption,
} from "../lib/crypto/localEncryption";

export interface Wallet {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  balance: {
    xlm: string;
    usdc?: string;
    eurc?: string;
  };
  isDefault: boolean;
  createdAt: number;
}
/**
 * Represents the wallet context state and actions managed by WalletProvider.
 *
 * Managed State:
 * - `wallets`: List of stored wallets including public key, address, balances, and metadata.
 * - `selectedWallet`: Currently active wallet selected for transactions and views.
 * - `isLoading`: Boolean indicating whether wallet data is being loaded or processed.
 * - `isUnlocked`: Boolean indicating whether local encrypted storage is unlocked with session passphrase.
 * - `error`: Error message string if a wallet operation fails, or null if no error.
 * - `passphraseSet`: Boolean indicating if an encryption passphrase has been configured.
 */
export interface WalletContextType {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  isLoading: boolean;
  isUnlocked: boolean;
  error: string | null;
  passphraseSet: boolean;
  addWallet: (wallet: Omit<Wallet, "id" | "createdAt">) => void;
  removeWallet: (id: string) => void;
  selectWallet: (id: string) => void;
  updateWalletBalance: (id: string, balance: Wallet["balance"]) => void;
  updateWalletName: (id: string, name: string) => void;
  setDefaultWallet: (id: string) => void;
  refreshBalances: () => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  setPassphrase: (passphrase: string) => Promise<void>;
  changePassphrase: (oldPassphrase: string, newPassphrase: string) => Promise<boolean>;
  resetLocalData: () => void;
  lock: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLETS_STORAGE_KEY = "stellarspend_wallets";
const SELECTED_WALLET_KEY = "stellarspend_selected_wallet";

// Mock wallet data for demonstration
const MOCK_WALLETS: Wallet[] = [
  {
    id: "wallet_1",
    name: "Main Wallet",
    address: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    publicKey: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    balance: {
      xlm: "1250.50",
      usdc: "500.00",
      eurc: "100.00",
    },
    isDefault: true,
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: "wallet_2",
    name: "Savings",
    address: "GBCS422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    publicKey: "GBCS422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    balance: {
      xlm: "5000.00",
      usdc: "2000.00",
    },
    isDefault: false,
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: "wallet_3",
    name: "Trading",
    address: "GTRD422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    publicKey: "GTRD422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    balance: {
      xlm: "250.00",
      usdc: "1000.00",
      eurc: "500.00",
    },
    isDefault: false,
    createdAt: Date.now() - 86400000 * 5,
  },
];

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passphraseSet, setPassphraseSetState] = useState(isPassphraseSet());
  const [sessionPassphrase, setSessionPassphrase] = useState<string | null>(null);

  // Load wallets from localStorage on mount
  const loadWallets = useCallback(async (passphrase?: string) => {
    try {
      // First, check if there's plaintext data that needs migration
      const hasPlaintextWallets = detectPlaintextData(WALLETS_STORAGE_KEY);
      const hasPlaintextSelected = detectPlaintextData(SELECTED_WALLET_KEY);

      // If passphrase is set and we have plaintext data, migrate it
      if (passphrase && (hasPlaintextWallets || hasPlaintextSelected)) {
        // Migrate wallets
        if (hasPlaintextWallets) {
          const plaintextWallets = loadPlaintext<Wallet[]>(WALLETS_STORAGE_KEY);
          if (plaintextWallets) {
            await migrateToEncrypted(WALLETS_STORAGE_KEY, passphrase, plaintextWallets);
          }
        }
        // Migrate selected wallet ID
        if (hasPlaintextSelected) {
          const plaintextSelected = loadPlaintext<string>(SELECTED_WALLET_KEY);
          if (plaintextSelected) {
            await migrateToEncrypted(SELECTED_WALLET_KEY, passphrase, plaintextSelected);
          }
        }
        setPassphraseSetState(true);
        setPassphraseSet();
      }

      // Try to load encrypted data
      let loadedWallets: Wallet[] | null = null;
      let loadedSelectedId: string | null = null;

      if (passphrase) {
        loadedWallets = await loadEncrypted<Wallet[]>(WALLETS_STORAGE_KEY, passphrase);
        loadedSelectedId = await loadEncrypted<string>(SELECTED_WALLET_KEY, passphrase);
      }

      // If no encrypted data, check plaintext
      if (!loadedWallets) {
        const plaintext = loadPlaintext<Wallet[]>(WALLETS_STORAGE_KEY);
        if (plaintext) {
          loadedWallets = plaintext;
          // If we have plaintext but passphrase is provided, migrate
          if (passphrase) {
            await migrateToEncrypted(WALLETS_STORAGE_KEY, passphrase, plaintext);
            const plaintextSelected = loadPlaintext<string>(SELECTED_WALLET_KEY);
            if (plaintextSelected) {
              await migrateToEncrypted(SELECTED_WALLET_KEY, passphrase, plaintextSelected);
            }
            setPassphraseSetState(true);
            setPassphraseSet();
          }
        }
      }

      // If still no wallets, initialize with mock data
      if (!loadedWallets) {
        // If passphrase is set, encrypt mock data
        if (passphrase) {
          await saveEncrypted(WALLETS_STORAGE_KEY, MOCK_WALLETS, passphrase);
          const defaultWallet = MOCK_WALLETS.find(w => w.isDefault);
          if (defaultWallet) {
            await saveEncrypted(SELECTED_WALLET_KEY, defaultWallet.id, passphrase);
          }
          setPassphraseSetState(true);
          setPassphraseSet();
        } else {
          // Save plaintext mock data (will be migrated on first unlock)
          localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(MOCK_WALLETS));
          const defaultWallet = MOCK_WALLETS.find(w => w.isDefault);
          if (defaultWallet) {
            localStorage.setItem(SELECTED_WALLET_KEY, defaultWallet.id);
          }
        }
        loadedWallets = MOCK_WALLETS;
        loadedSelectedId = MOCK_WALLETS.find(w => w.isDefault)?.id || MOCK_WALLETS[0]?.id || null;
      }

      setWallets(loadedWallets);
      
      if (loadedSelectedId) {
        setSelectedWalletId(loadedSelectedId);
      } else {
        const defaultWallet = loadedWallets.find(w => w.isDefault);
        setSelectedWalletId(defaultWallet?.id || loadedWallets[0]?.id || null);
      }

      if (passphrase) {
        setIsUnlocked(true);
        setSessionPassphrase(passphrase);
      }

      setPassphraseSetState(isPassphraseSet());

    } catch (err) {
      setError("Failed to load wallets");
      console.error("Failed to load wallets:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadWallets();
    };
    init();
  }, [loadWallets]);

  // Save wallets to localStorage whenever they change
  useEffect(() => {
    const saveWallets = async () => {
      if (!isLoading && wallets.length > 0 && sessionPassphrase) {
        try {
          await saveEncrypted(WALLETS_STORAGE_KEY, wallets, sessionPassphrase);
        } catch (err) {
          console.error("Failed to save wallets:", err);
        }
      }
    };
    saveWallets();
  }, [wallets, isLoading, sessionPassphrase]);

  // Save selected wallet to localStorage
  useEffect(() => {
    const saveSelected = async () => {
      if (!isLoading && selectedWalletId && sessionPassphrase) {
        try {
          await saveEncrypted(SELECTED_WALLET_KEY, selectedWalletId, sessionPassphrase);
        } catch (err) {
          console.error("Failed to save selected wallet:", err);
        }
      }
    };
    saveSelected();
  }, [selectedWalletId, isLoading, sessionPassphrase]);

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await loadWallets(passphrase);
      return true;
    } catch (err) {
      setError("Invalid passphrase");
      console.error("Unlock failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadWallets]);

  const setPassphrase = useCallback(async (passphrase: string): Promise<void> => {
    try {
      // Migrate any existing plaintext data
      const hasPlaintextWallets = detectPlaintextData(WALLETS_STORAGE_KEY);
      const hasPlaintextSelected = detectPlaintextData(SELECTED_WALLET_KEY);

      if (hasPlaintextWallets) {
        const plaintextWallets = loadPlaintext<Wallet[]>(WALLETS_STORAGE_KEY);
        if (plaintextWallets) {
          await migrateToEncrypted(WALLETS_STORAGE_KEY, passphrase, plaintextWallets);
        }
      }
      if (hasPlaintextSelected) {
        const plaintextSelected = loadPlaintext<string>(SELECTED_WALLET_KEY);
        if (plaintextSelected) {
          await migrateToEncrypted(SELECTED_WALLET_KEY, passphrase, plaintextSelected);
        }
      }

      // If no plaintext data, encrypt current state
      if (!hasPlaintextWallets && wallets.length > 0) {
        await saveEncrypted(WALLETS_STORAGE_KEY, wallets, passphrase);
        if (selectedWalletId) {
          await saveEncrypted(SELECTED_WALLET_KEY, selectedWalletId, passphrase);
        }
      }

      setPassphraseSetState(true);
      setPassphraseSet();
      setSessionPassphrase(passphrase);
      setIsUnlocked(true);
      
      // Clear any plaintext data
      localStorage.removeItem(WALLETS_STORAGE_KEY);
      localStorage.removeItem(SELECTED_WALLET_KEY);

    } catch (err) {
      setError("Failed to set passphrase");
      console.error("Failed to set passphrase:", err);
      throw err;
    }
  }, [wallets, selectedWalletId]);

  const changePassphrase = useCallback(async (oldPassphrase: string, newPassphrase: string): Promise<boolean> => {
    try {
      // Verify old passphrase works
      const testWallets = await loadEncrypted<Wallet[]>(WALLETS_STORAGE_KEY, oldPassphrase);
      if (!testWallets) {
        setError("Invalid current passphrase");
        return false;
      }

      // Re-encrypt with new passphrase
      await saveEncrypted(WALLETS_STORAGE_KEY, testWallets, newPassphrase);
      
      if (selectedWalletId) {
        await saveEncrypted(SELECTED_WALLET_KEY, selectedWalletId, newPassphrase);
      }

      setSessionPassphrase(newPassphrase);
      return true;
    } catch (err) {
      setError("Failed to change passphrase");
      console.error("Failed to change passphrase:", err);
      return false;
    }
  }, [selectedWalletId]);

  const resetLocalData = useCallback(() => {
    resetEncryption();
    localStorage.removeItem(WALLETS_STORAGE_KEY);
    localStorage.removeItem(SELECTED_WALLET_KEY);
    setWallets([]);
    setSelectedWalletId(null);
    setSessionPassphrase(null);
    setIsUnlocked(false);
    setPassphraseSetState(false);
    // Reload with mock data
    loadWallets();
  }, [loadWallets]);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    setSessionPassphrase(null);
  }, []);

  const addWallet = useCallback((wallet: Omit<Wallet, "id" | "createdAt">) => {
    const newWallet: Wallet = {
      ...wallet,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    setWallets((prev) => {
      if (prev.length === 0) {
        newWallet.isDefault = true;
      }
      return [...prev, newWallet];
    });

    setSelectedWalletId((prev) => prev || newWallet.id);
  }, []);

  const removeWallet = useCallback((id: string) => {
    setWallets((prev) => {
      const walletToRemove = prev.find((w) => w.id === id);
      const remaining = prev.filter((w) => w.id !== id);
      
      if (walletToRemove?.isDefault && remaining.length > 0) {
        remaining[0].isDefault = true;
      }
      
      return remaining;
    });

    setSelectedWalletId((prev) => {
      if (prev === id) {
        const remaining = wallets.filter((w) => w.id !== id);
        const defaultWallet = remaining.find((w) => w.isDefault);
        return defaultWallet?.id || remaining[0]?.id || null;
      }
      return prev;
    });
  }, [wallets]);

  const selectWallet = useCallback((id: string) => {
    setSelectedWalletId(id);
  }, []);

  const updateWalletBalance = useCallback((id: string, balance: Wallet["balance"]) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, balance } : w))
    );
  }, []);

  const updateWalletName = useCallback((id: string, name: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name } : w))
    );
  }, []);

  const setDefaultWallet = useCallback((id: string) => {
    setWallets((prev) =>
      prev.map((w) => ({
        ...w,
        isDefault: w.id === id,
      }))
    );
  }, []);

  const refreshBalances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setWallets((prev) =>
        prev.map((w) => ({
          ...w,
          balance: {
            ...w.balance,
            xlm: (parseFloat(w.balance.xlm) + (Math.random() - 0.5) * 10).toFixed(2),
          },
        }))
      );
    } catch (err) {
      setError("Failed to refresh balances");
      console.error("Failed to refresh balances:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || null;

  const value: WalletContextType = {
    wallets,
    selectedWallet,
    isLoading,
    isUnlocked,
    error,
    passphraseSet,
    addWallet,
    removeWallet,
    selectWallet,
    updateWalletBalance,
    updateWalletName,
    setDefaultWallet,
    refreshBalances,
    unlock,
    setPassphrase,
    changePassphrase,
    resetLocalData,
    lock,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return context;
}

