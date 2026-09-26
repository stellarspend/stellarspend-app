"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import {
  fetchBalances,
  type AssetBalance,
  type WalletBalances,
} from "@/lib/api/client";
import {
  startAccountStream,
  subscribeAccountStream,
  subscribeAccountStreamStatus,
} from "@/lib/stellar/accountStream";

// ─── Asset colour map ─────────────────────────────────────────────────────

const ASSET_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; symbol: string }
> = {
  XLM: {
    color: "#e8b84b",
    bg: "bg-[#e8b84b]/10",
    border: "border-[#e8b84b]/20",
    symbol: "✦",
  },
  USDC: {
    color: "#4aa9e8",
    bg: "bg-[#4aa9e8]/10",
    border: "border-[#4aa9e8]/20",
    symbol: "$",
  },
  EURC: {
    color: "#a78bfa",
    bg: "bg-[#a78bfa]/10",
    border: "border-[#a78bfa]/20",
    symbol: "€",
  },
};

// ─── Single asset card ────────────────────────────────────────────────────

function AssetCard({ asset, index }: { asset: AssetBalance; index: number }) {
  const cfg = ASSET_CONFIG[asset.asset] ?? ASSET_CONFIG.XLM;
  const isUp = asset.change24h >= 0;

  return (
    <motion.div
      data-testid="balance-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
      className={`relative flex flex-col gap-4 p-5 rounded-2xl border ${cfg.border} bg-white/[0.025] hover:bg-white/[0.04] hover:border-opacity-60 transition-all duration-300 overflow-hidden`}
    >
      {/* faint glow */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ backgroundColor: cfg.color }}
      />

      {/* Header row */}
      <div className="flex items-center justify-between relative z-10">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} text-base font-bold`}
          style={{ color: cfg.color }}
        >
          {cfg.symbol}
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-bold ${isUp ? "text-[#4ade80]" : "text-red-400"}`}
        >
          {isUp ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {isUp ? "+" : ""}
          {asset.change24h.toFixed(2)}%
        </span>
      </div>

      {/* Balance */}
      <div className="relative z-10">
        <p className="text-[#7a8aaa] text-[10px] uppercase tracking-widest font-bold mb-0.5">
          {asset.asset}
        </p>
        <p className="text-white text-xl font-black leading-tight">
          {asset.balance}
        </p>
        <p className="text-[#7a8aaa] text-xs mt-0.5">
          ≈ $
          {asset.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      data-testid="balance-skeleton"
      className="flex flex-col gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.025] animate-pulse"
    >
      {/* Header row - matches AssetCard header */}
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10" />
        <div className="w-20 h-5 rounded bg-white/10" />
      </div>

      {/* Balance section - matches AssetCard balance */}
      <div className="space-y-1.5">
        <div className="w-14 h-2.5 rounded bg-white/10" />
        <div className="w-28 h-7 rounded bg-white/10" />
        <div className="w-20 h-3 rounded bg-white/10" />
      </div>
    </div>
  );
}

// ─── Balances Widget ──────────────────────────────────────────────────────

export default function BalancesWidget() {
  const [data, setData] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [newActivity, setNewActivity] = useState(false);
  const activityTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStreamAt = React.useRef(0);
  const lastStreamAccount = React.useRef<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) {
      setSpinning(true);
      setLoading(true);
    }
    try {
      const result = await fetchBalances();
      setData(result);
    } catch {
      // A failed refresh must not clear the balances we already have; when
      // there is nothing to show the skeleton contract keeps the loading
      // placeholders in the grid (see data-testid="balance-skeleton").
    } finally {
      if (manual) {
        setLoading(false);
        setSpinning(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const result = await fetchBalances();
        if (mounted) {
          setData(result);
        }
      } catch {
        // Swallow so the initial fetch cannot surface as an unhandled
        // rejection; `data` stays null and the skeletons remain rendered.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Live Horizon SSE stream ─────────────────────────────────────────────
  useEffect(() => {
    const handleStreamActivity = () => {
      const now = Date.now();
      if (now - lastStreamAt.current < 2000) return;
      lastStreamAt.current = now;

      load();
      setNewActivity(true);
      if (activityTimeout.current) clearTimeout(activityTimeout.current);
      activityTimeout.current = setTimeout(() => setNewActivity(false), 3000);
    };

    const handleStreamStatus = (state: {
      status: string;
      account: string | null;
    }) => {
      if (
        state.status === "connected" &&
        state.account &&
        state.account !== lastStreamAccount.current
      ) {
        lastStreamAccount.current = state.account;
        load();
      }
    };

    const unsubscribeEvent = subscribeAccountStream(handleStreamActivity);
    const unsubscribeStatus = subscribeAccountStreamStatus(handleStreamStatus);
    startAccountStream();

    return () => {
      unsubscribeEvent();
      unsubscribeStatus();
      if (activityTimeout.current) clearTimeout(activityTimeout.current);
    };
  }, [load]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 space-y-5">
      {/* Widget header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-[#e8b84b]" />
          <h2 className="text-sm font-black text-white uppercase tracking-[0.15em]">
            Balances
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {data && (
            <p className="text-[10px] text-[#7a8aaa] font-mono hidden sm:block">
              Updated{" "}
              {new Date(data.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {newActivity && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80] text-[9px] font-bold uppercase tracking-widest animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
              Live
            </span>
          )}
          <button
            id="balances-refresh"
            onClick={() => load(true)}
            disabled={spinning}
            aria-label="Refresh balances"
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#7a8aaa] ${spinning ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Total banner */}
      {data ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-end justify-between px-5 py-4 rounded-2xl bg-[#e8b84b]/[0.07] border border-[#e8b84b]/20"
        >
          <div>
            <p className="text-[10px] text-[#e8b84b] uppercase tracking-widest font-bold mb-0.5">
              Total Portfolio
            </p>
            <p className="text-3xl font-black text-white">
              $
              {data.totalUsd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <span className="text-xs text-[#e8b84b] font-bold uppercase tracking-widest">
            USD
          </span>
        </motion.div>
      ) : (
        <div
          data-testid="balances-total-skeleton"
          className="px-5 py-4 rounded-2xl bg-white/5 border border-white/10 animate-pulse h-[72px]"
        />
      )}

      {/* Asset cards grid */}
      <div
        data-testid="balances-grid"
        aria-busy={loading || !data}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {loading || !data
          ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
          : data.balances.map((asset, i) => (
              <AssetCard key={asset.asset} asset={asset} index={i} />
            ))}
      </div>
    </div>
  );
}
