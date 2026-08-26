"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Users, ShieldAlert } from "lucide-react";
import { paySplitShare, disputeSplitShare, subscribeToSplit, collectionProgress } from "@/lib/stellar/escrowContract";
import { useNotifications } from "@/context/NotificationContext";
import type { SplitBill } from "@/lib/types/splits";

interface PendingSplitCardProps {
  split: SplitBill;
  publicKey: string | null;
  onUpdate?: (split: SplitBill) => void;
}

export default function PendingSplitCard({ split: initialSplit, publicKey, onUpdate }: PendingSplitCardProps) {
  const { addNotification } = useNotifications();
  const [split, setSplit] = useState<SplitBill>(initialSplit);
  const [paying, setPaying] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publicKey) return;
    const unsubscribe = subscribeToSplit(initialSplit.id, publicKey, (updated) => {
      if (updated) {
        setSplit(updated);
        onUpdate?.(updated);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSplit.id, publicKey]);

  const { paid, total } = collectionProgress(split);
  const progressPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const isCreator = publicKey === split.creator;
  const myShare = split.shares.find((s) => s.participant === publicKey);

  const handlePay = async () => {
    if (!publicKey) return;
    setPaying(true);
    setError("");
    try {
      const updated = await paySplitShare(publicKey, split.id);
      setSplit(updated);
      onUpdate?.(updated);
      addNotification("success", `Paid your share of "${updated.description}".`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addNotification("error", `Failed to pay share: ${msg}`);
    } finally {
      setPaying(false);
    }
  };

  const handleDispute = async () => {
    if (!publicKey || !disputeReason.trim()) {
      setError("Provide a reason for the dispute.");
      return;
    }
    setPaying(true);
    setError("");
    try {
      const updated = await disputeSplitShare(publicKey, split.id, disputeReason.trim());
      setSplit(updated);
      onUpdate?.(updated);
      setDisputing(false);
      setDisputeReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addNotification("error", `Failed to file dispute: ${msg}`);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-xl">
            <Users className="w-4 h-4 text-[#e8b84b]" />
          </div>
          <div>
            <h3 className="text-white font-bold">{split.description}</h3>
            <p className="text-[#7a8aaa] text-xs">
              {split.totalAmount.toFixed(2)} {split.asset} · {isCreator ? "You requested" : "Requested by " + split.creator.slice(0, 8) + "..."}
            </p>
          </div>
        </div>

        {split.status === "released" && (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Released
          </span>
        )}
        {split.status === "disputed" && (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full shrink-0">
            <AlertTriangle className="w-3 h-3" /> Disputed
          </span>
        )}
        {split.status === "collecting" && (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#e8b84b] bg-[#e8b84b]/10 border border-[#e8b84b]/20 px-2.5 py-1 rounded-full shrink-0">
            <Clock className="w-3 h-3" /> Collecting
          </span>
        )}
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa] px-0.5 mb-1.5">
          <span>{paid} of {total} paid</span>
          <span>{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#e8b84b] to-[#f0c85a] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {split.status === "released" && (
        <p className="text-xs text-[#7a8aaa] bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
          Funds released to {isCreator ? "you" : "the requester"}
          {split.releaseTransactionHash ? ` · tx ${split.releaseTransactionHash.slice(0, 8)}...` : ""}
        </p>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2 text-red-400 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {myShare && split.status === "collecting" && myShare.status === "pending" && !disputing && (
        <div className="flex gap-3">
          <button
            onClick={handlePay}
            disabled={paying}
            className="flex-1 py-3 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-xl hover:bg-[#f0c85a] transition-all disabled:opacity-60 text-xs uppercase tracking-wider"
          >
            {paying ? "Paying..." : `Pay My Share (${myShare.amount.toFixed(2)} ${split.asset})`}
          </button>
          <button
            onClick={() => setDisputing(true)}
            disabled={paying}
            className="px-4 py-3 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-[#7a8aaa] hover:text-red-400 font-bold rounded-xl transition-all disabled:opacity-60 text-xs uppercase tracking-wider"
          >
            Dispute
          </button>
        </div>
      )}

      {myShare && disputing && (
        <div className="space-y-3">
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Why are you disputing this share?"
            rows={2}
            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-xs placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 transition-all resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={handleDispute}
              disabled={paying}
              className="flex-1 py-2.5 bg-red-500/15 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-500/25 transition-all disabled:opacity-60 text-xs uppercase tracking-wider"
            >
              {paying ? "Filing..." : "Submit Dispute"}
            </button>
            <button
              onClick={() => {
                setDisputing(false);
                setDisputeReason("");
                setError("");
              }}
              disabled={paying}
              className="px-4 py-2.5 bg-white/5 border border-white/10 text-[#7a8aaa] hover:text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {myShare && myShare.status === "paid" && split.status === "collecting" && (
        <p className="text-xs text-green-400/80 font-semibold">✓ You&apos;ve paid your share. Waiting on the rest.</p>
      )}

      {myShare && myShare.status === "disputed" && (
        <p className="text-xs text-red-400/80 font-semibold">Your share is under arbitration: &quot;{myShare.disputeReason}&quot;</p>
      )}

      {isCreator && split.status === "collecting" && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5">
          {split.shares.map((s) => (
            <div key={s.participant} className="flex items-center justify-between text-xs">
              <span className="text-[#7a8aaa] font-mono">{s.participant.slice(0, 8)}...{s.participant.slice(-4)}</span>
              <span
                className={
                  s.status === "paid"
                    ? "text-green-400 font-bold"
                    : s.status === "disputed"
                    ? "text-red-400 font-bold"
                    : "text-[#7a8aaa]"
                }
              >
                {s.status === "paid" ? "Paid" : s.status === "disputed" ? "Disputed" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
