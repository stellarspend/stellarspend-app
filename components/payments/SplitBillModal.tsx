"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Users, Plus, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { createSplit } from "@/lib/stellar/escrowContract";
import { useNotifications } from "@/context/NotificationContext";
import type { SplitBill, SplitMethod } from "@/lib/types/splits";

interface SplitBillModalProps {
  publicKey: string | null;
  onClose: () => void;
  onCreated: (split: SplitBill) => void;
}

interface ParticipantRow {
  address: string;
  amount: string; // only used in custom mode
}

export default function SplitBillModal({ publicKey, onClose, onCreated }: SplitBillModalProps) {
  const { addNotification } = useNotifications();

  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [asset, setAsset] = useState<"XLM" | "USDC" | "EURC">("USDC");
  const [method, setMethod] = useState<SplitMethod>("even");
  const [participants, setParticipants] = useState<ParticipantRow[]>([
    { address: "", amount: "" },
    { address: "", amount: "" },
  ]);
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const parsedTotal = parseFloat(totalAmount) || 0;
  const evenShare = participants.length > 0 ? parsedTotal / participants.length : 0;

  const customTotal = useMemo(
    () => participants.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    [participants],
  );

  const updateParticipant = (index: number, field: keyof ParticipantRow, value: string) => {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addParticipant = () => setParticipants((prev) => [...prev, { address: "", amount: "" }]);

  const removeParticipant = (index: number) => {
    if (participants.length <= 2) return; // a split needs at least 2 participants
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    if (!publicKey) {
      setFormError("Connect your wallet to create a split.");
      return false;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return false;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setFormError("Total amount must be a positive number.");
      return false;
    }
    for (const p of participants) {
      if (!p.address.trim().startsWith("G") || p.address.trim().length !== 56) {
        setFormError("Every participant needs a valid 56-character Stellar address starting with 'G'.");
        return false;
      }
    }
    const addresses = participants.map((p) => p.address.trim());
    if (new Set(addresses).size !== addresses.length) {
      setFormError("Participant addresses must be unique.");
      return false;
    }
    if (method === "custom") {
      for (const p of participants) {
        if (isNaN(parseFloat(p.amount)) || parseFloat(p.amount) <= 0) {
          setFormError("Every participant needs a positive custom amount.");
          return false;
        }
      }
      if (Math.abs(customTotal - parsedTotal) > 0.01) {
        setFormError(`Custom amounts (${customTotal.toFixed(2)}) must add up to the total (${parsedTotal.toFixed(2)}).`);
        return false;
      }
    }
    setFormError("");
    return true;
  };

  const handleCreate = async () => {
    if (!validate() || !publicKey) return;

    setStatus("submitting");
    try {
      const split = await createSplit(publicKey, {
        description: description.trim(),
        totalAmount: parsedTotal,
        asset,
        method,
        participants: participants.map((p) => ({
          address: p.address.trim(),
          amount: method === "even" ? evenShare : parseFloat(p.amount),
        })),
      });

      setStatus("success");
      addNotification("success", `Split "${split.description}" created for ${participants.length} participants.`);
      onCreated(split);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatus("idle");
      setFormError(errMsg || "Failed to create split.");
      addNotification("error", `Failed to create split: ${errMsg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#060813]/85 backdrop-blur-md"
        onClick={status === "idle" ? onClose : undefined}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative z-10 w-full max-w-lg rounded-[32px] bg-[#0c1020] border border-white/10 shadow-2xl p-8 overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#e8b84b]/10 blur-[60px] pointer-events-none" />

        {status === "idle" && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/10 text-[#7a8aaa] hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {status !== "success" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-2xl">
                <Users className="w-6 h-6 text-[#e8b84b]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Split a Bill</h2>
                <p className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider mt-0.5">
                  Escrow-backed payment request
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={status === "submitting"}
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white text-sm placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Total Amount
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    disabled={status === "submitting"}
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-bold placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
                  />
                </div>
                <div className="w-32">
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Asset
                  </label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as "XLM" | "USDC" | "EURC")}
                    disabled={status === "submitting"}
                    className="w-full px-4 py-3.5 bg-[#0c1020] border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
                  >
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                    <option value="EURC">EURC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                  Split Method
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMethod("even")}
                    disabled={status === "submitting"}
                    className={`flex-1 py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                      method === "even"
                        ? "bg-[#e8b84b]/15 border-[#e8b84b]/40 text-[#e8b84b]"
                        : "bg-white/[0.03] border-white/10 text-[#7a8aaa] hover:text-white"
                    }`}
                  >
                    Even Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("custom")}
                    disabled={status === "submitting"}
                    className={`flex-1 py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                      method === "custom"
                        ? "bg-[#e8b84b]/15 border-[#e8b84b]/40 text-[#e8b84b]"
                        : "bg-white/[0.03] border-white/10 text-[#7a8aaa] hover:text-white"
                    }`}
                  >
                    Custom Amounts
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em]">
                    Participants
                  </label>
                  <button
                    type="button"
                    onClick={addParticipant}
                    disabled={status === "submitting"}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#e8b84b] hover:text-[#f0c85a] transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                <div className="space-y-3">
                  {participants.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="G..."
                        value={p.address}
                        onChange={(e) => updateParticipant(i, "address", e.target.value)}
                        disabled={status === "submitting"}
                        className="flex-1 min-w-0 px-3 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white font-mono text-xs placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
                      />
                      {method === "custom" ? (
                        <input
                          type="number"
                          placeholder="0.00"
                          value={p.amount}
                          onChange={(e) => updateParticipant(i, "amount", e.target.value)}
                          disabled={status === "submitting"}
                          className="w-24 px-3 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-xs font-bold placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all disabled:opacity-50"
                        />
                      ) : (
                        <div className="w-24 px-3 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-[#e8b84b] text-xs font-bold flex items-center justify-center">
                          {evenShare > 0 ? evenShare.toFixed(2) : "—"}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeParticipant(i)}
                        disabled={status === "submitting" || participants.length <= 2}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[#7a8aaa] hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {method === "custom" && parsedTotal > 0 && (
                  <p className="mt-2 text-[10px] font-semibold text-[#7a8aaa]">
                    Allocated {customTotal.toFixed(2)} of {parsedTotal.toFixed(2)} {asset}
                  </p>
                )}
              </div>

              <button
                onClick={handleCreate}
                disabled={status === "submitting"}
                className="w-full py-4 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-2xl hover:bg-[#f0c85a] transition-all hover:-translate-y-0.5 shadow-xl shadow-[#e8b84b]/10 active:translate-y-0 mt-4 uppercase tracking-widest text-xs disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {status === "submitting" ? "Creating Split..." : "Create Split & Escrow Request"}
              </button>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#e8b84b]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Split Created</h3>
              <p className="text-[#7a8aaa] text-sm max-w-xs mx-auto">
                Each participant can now pay their share into escrow. Funds release to you automatically once everyone has paid.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full max-w-xs py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
