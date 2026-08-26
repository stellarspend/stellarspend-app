"use client";

import React, { useState } from "react";
import { useWalletContext } from "../../context/WalletContext";
import { useOffline } from "../offline/OfflineProvider";

interface PassphraseSetupProps {
  onComplete?: () => void;
}

/**
 * PassphraseSetup
 *
 * Manages the encryption passphrase lifecycle for the wallet. It lets users set
 * a new passphrase to encrypt their wallet data and offline actions, unlock
 * previously encrypted local data, or reset all local data when the passphrase
 * is forgotten.
 *
 * It appears whenever the wallet's encrypted data is locked — e.g. on first run
 * (when no passphrase has been set yet) or after a session lock — and is
 * rendered in place of the normal app content until the passphrase is provided.
 */
export function PassphraseSetup({ onComplete }: PassphraseSetupProps) {
  const { passphraseSet, setPassphrase, unlock, resetLocalData } =
    useWalletContext();
  const { unlockQueue } = useOffline();

  const [mode, setMode] = useState<"set" | "unlock" | "reset">(() => {
    if (passphraseSet) return "unlock";
    return "set";
  });

  const [passphrase, setPassphraseInput] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSetPassphrase = async (e: React.FormEvent) => {
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
    //   await unlockQueue(passphrase);
    //   setMode("unlock");
    //   onComplete?.();
    // } catch (err) {
    //   setError("Failed to set passphrase. Please try again.");
    // } finally {
    //   setIsLoading(false);
    // }
    setIsLoading(true);
    try {
      await setPassphrase(passphrase);
      await unlockQueue(passphrase);
      setMode("unlock");
      onComplete?.();
    } catch {
      setError("Failed to set passphrase. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const success = await unlock(passphrase);
      if (success) {
        await unlockQueue(passphrase);
        onComplete?.();
      } else {
        setError("Invalid passphrase. Please try again.");
      }
    } catch {
      setError("Failed to unlock. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    resetLocalData();
    setPassphraseInput("");
    setConfirmPassphrase("");
    setError(null);
    setMode("set");
    setShowResetConfirm(false);
  };

  if (mode === "set") {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Set Up Encryption</h2>
        <p className="text-gray-600 mb-4">
          Set a passphrase to encrypt your wallet data and offline actions. This
          passphrase is never stored anywhere.
        </p>

        <form onSubmit={handleSetPassphrase}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Passphrase</label>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphraseInput(e.target.value)}
                className="w-full px-3 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter passphrase (min 6 characters)"
                disabled={isLoading}
              />
              <button
                type="button"
                aria-label={
                  showPassphrase ? "Hide passphrase" : "Show passphrase"
                }
                onClick={() => setShowPassphrase((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-gray-600 hover:text-gray-900"
              >
                {showPassphrase ? "Hide" : "Show"}
              </button>
            </div>
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
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isLoading ? "Setting up..." : "Set Passphrase"}
          </button>
        </form>
      </div>
    );
  }

  if (mode === "unlock") {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Unlock Your Data</h2>
        <p className="text-gray-600 mb-4">
          Enter your passphrase to unlock your encrypted data.
        </p>

        <form onSubmit={handleUnlock}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Passphrase</label>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphraseInput(e.target.value)}
                className="w-full px-3 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your passphrase"
                disabled={isLoading}
              />
              <button
                type="button"
                aria-label={
                  showPassphrase ? "Hide passphrase" : "Show passphrase"
                }
                onClick={() => setShowPassphrase((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-gray-600 hover:text-gray-900"
              >
                {showPassphrase ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isLoading ? "Unlocking..." : "Unlock"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-sm text-gray-500 hover:text-red-600 transition"
          >
            Forgot passphrase? Reset local data
          </button>
        </div>

        {showResetConfirm && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 mb-3">
              This will delete all encrypted local data. You can reconnect your
              wallets after resetting.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
