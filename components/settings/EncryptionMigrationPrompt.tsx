"use client";

import React, { useState } from "react";
import { useWalletContext } from "../../context/WalletContext";
import { detectPlaintextData } from "../../lib/crypto/localEncryption";

const WALLETS_STORAGE_KEY = "stellarspend_wallets";
const QUEUE_STORAGE_KEY = "stellarspend_offline_queue";

/**
 * Prompts the user to create and confirm a passphrase when unencrypted
 * (plaintext) wallet or offline-queue data is detected in localStorage.
 *
 * This modal appears as part of the encryption migration flow, inviting the
 * user to set a passphrase so their legacy data can be encrypted. It renders
 * nothing when no plaintext data is present.
 */
export function EncryptionMigrationPrompt() {
  const { setPassphrase } = useWalletContext();
  const [hasPlaintextData, setHasPlaintextData] = useState(() => {
    const hasWallets = detectPlaintextData(WALLETS_STORAGE_KEY);
    const hasQueue = detectPlaintextData(QUEUE_STORAGE_KEY);
    return hasWallets || hasQueue;
  });
  const [passphrase, setPassphraseInput] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!hasPlaintextData) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passphrase.length < 6) {
      setError("Passphrase must be at least 6 characters");
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }

    // setIsLoading(true);
    // try {
    //   await setPassphrase(passphrase);
    //   setHasPlaintextData(false);
    // } catch (err) {
    //   setError("Failed to encrypt data. Please try again.");
    // } finally {
    //   setIsLoading(false);
    // }
    setIsLoading(true);
    try {
      await setPassphrase(passphrase);
      setHasPlaintextData(false);
    } catch {
      setError("Failed to encrypt data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-2">Encrypt Your Data</h2>
        <p className="text-gray-600 mb-4">
          We found existing wallet data that needs to be encrypted.
          Please set a passphrase to secure your data.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Passphrase (min 6 characters)
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphraseInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter passphrase"
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Confirm Passphrase
            </label>
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm passphrase"
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isLoading ? "Encrypting..." : "Encrypt My Data"}
          </button>
        </form>
      </div>
    </div>
  );
}
