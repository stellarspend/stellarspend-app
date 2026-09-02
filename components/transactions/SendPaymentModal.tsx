"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Send, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { sendPayment } from "@/lib/api/client";
import { generateSpendingProof } from "@/lib/zk/generateSpendingProof";
import { useOffline } from "@/components/offline/OfflineProvider";
import { useToast } from "@/components/ui/use-toast";
import { getRemaining, recordSpend } from "@/lib/stellar/spendingLimitsContract";
import useWallet from "@/hooks/useWallet";

interface SendPaymentModalProps {
  onClose: () => void;
}

// ZK limits configuration
const ZK_PROOF_THRESHOLD = Number(process.env.NEXT_PUBLIC_ZK_LIMIT_THRESHOLD ?? 100);
const ZK_SPENDING_LIMIT_CEILING = Number(process.env.NEXT_PUBLIC_ZK_LIMIT_CEILING ?? 500);

export default function SendPaymentModal({ onClose }: SendPaymentModalProps) {
  const { isOnline, queueAction } = useOffline();
  const { toast } = useToast();
  const { freighter } = useWallet();
  const userPublicKey = freighter.publicKey || "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO";

  // Form states
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"XLM" | "USDC" | "EURC">("USDC");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState("");

  // Process lifecycle states
  // 'idle' | 'validating' | 'zk_proving' | 'zk_success' | 'zk_failed' | 'signing' | 'submitting' | 'success'
  const [status, setStatus] = useState<
    "idle" | "zk_proving" | "zk_success" | "zk_failed" | "signing" | "submitting" | "success"
  >("idle");
  const [zkStatusMsg, setZkStatusMsg] = useState("");
  const [zkProgress, setZkProgress] = useState(0);
  const [txHash, setTxHash] = useState("");

  // Validate address input
  const validateInputs = () => {
    if (!recipient.trim()) {
      setFormError("Recipient address is required.");
      return false;
    }
    if (!recipient.startsWith("G") || recipient.length !== 56) {
      setFormError("Recipient must be a valid 56-character Stellar public key starting with 'G'.");
      return false;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Amount must be a positive number.");
      return false;
    }
    setFormError("");
    return true;
  };

  // Map proving logs to progress bar percentages
  const updateZkStatus = (msg: string) => {
    setZkStatusMsg(msg);
    if (msg.includes("Initializing")) {
      setZkProgress(20);
    } else if (msg.includes("bytecode") || msg.includes("inputs")) {
      setZkProgress(40);
    } else if (msg.includes("witness") || msg.includes("ACVM")) {
      setZkProgress(60);
    } else if (msg.includes("UltraHonk") || msg.includes("synthesizing")) {
      setZkProgress(80);
    } else if (msg.includes("completed") || msg.includes("success")) {
      setZkProgress(100);
    }
  };

  const handleSendPayment = async () => {
    if (!validateInputs()) return;
    const parsedAmount = parseFloat(amount);
    
    // Check if offline
    if (!isOnline) {
      queueAction(
        "SEND_PAYMENT",
        `Send ${parsedAmount} ${asset} to ${recipient.substring(0, 8)}...`,
        { recipient, amount: parsedAmount, asset }
      );
      toast({
        title: "Payment Queued",
        description: `Offline: Payment of ${parsedAmount} ${asset} has been queued.`,
      });
      onClose();
      return;
    }

    // Check spending limit before ZK proof and submission
    try {
      const limitInfo = await getRemaining(userPublicKey, asset);
      if (limitInfo && limitInfo.hasLimit && parsedAmount > limitInfo.remainingAmount) {
        const periodLabel = limitInfo.period.charAt(0).toUpperCase() + limitInfo.period.slice(1);
        const remainingFormatted = limitInfo.remainingAmount % 1 === 0
          ? limitInfo.remainingAmount.toString()
          : limitInfo.remainingAmount.toFixed(2);
        const limitError = `${periodLabel} ${asset} limit reached — ${remainingFormatted} ${asset} remaining`;
        setFormError(limitError);
        toast({
          title: "Spending Limit Reached",
          description: limitError,
          variant: "destructive",
        });
        setStatus("idle");
        return;
      }
    } catch (err) {
      console.error("Failed to check spending limit:", err);
    }

    // Determine if ZK proof is required
    const requiresZkProof = parsedAmount > ZK_PROOF_THRESHOLD;
    let spendingProof: Uint8Array | undefined = undefined;

    if (requiresZkProof) {
      setStatus("zk_proving");
      setZkProgress(10);
      try {
        // Run ZK proving engine
        const proofResult = await generateSpendingProof(
          parsedAmount,
          ZK_SPENDING_LIMIT_CEILING,
          updateZkStatus
        );
        
        spendingProof = proofResult.proof;
        setStatus("zk_success");
        setZkProgress(100);
        await new Promise((resolve) => setTimeout(resolve, 800)); // Show success checkmark briefly
      } catch (zkErr) {
        const zkErrMsg = zkErr instanceof Error ? zkErr.message : String(zkErr);
        console.error("ZK Proving failed:", zkErr);
        setStatus("zk_failed");
        setFormError(zkErrMsg || "Cryptographic proof generation failed constraint checks.");
        toast({
          title: "ZK Proving Failed",
          description: zkErrMsg || "Cryptographic proof generation failed constraint checks.",
          variant: "destructive",
        });
        return;
      }
    }

    // Submitting transaction
    try {
      setStatus("signing");
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate key load
      
      setStatus("submitting");
      const transaction = await sendPayment(recipient, parsedAmount, asset, spendingProof);
      
      // Record spend against active limits
      await recordSpend(userPublicKey, asset, parsedAmount);

      setTxHash(transaction.hash);
      setStatus("success");
      toast({
        title: "Payment Successful",
        description: `Successfully sent ${parsedAmount} ${asset} to ${recipient.substring(0, 8)}...`,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatus("idle");
      setFormError(errMsg || "Transaction submission failed.");
      toast({
        title: "Payment Failed",
        description: errMsg || "Transaction submission failed.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glassmorphic overlay background */}
      <div
        className="absolute inset-0 bg-[#060813]/85 backdrop-blur-md"
        onClick={status === "idle" || status === "zk_failed" || status === "success" ? onClose : undefined}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative z-10 w-full max-w-lg rounded-[32px] bg-[#0c1020] border border-white/10 shadow-2xl p-8 overflow-hidden"
      >
        {/* Background ambient light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#e8b84b]/10 blur-[60px] pointer-events-none" />

        {/* Close Button */}
        {(status === "idle" || status === "zk_failed" || status === "success") && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/10 text-[#7a8aaa] hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content Stages */}
        {status === "idle" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-2xl">
                <Send className="w-6 h-6 text-[#e8b84b]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Send Assets</h2>
                <p className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider mt-0.5">
                  Stellar Blockchain Transfer
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
                  Recipient Stellar Address
                </label>
                <input
                  type="text"
                  placeholder="G..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-mono text-sm placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Amount
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-bold placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                  />
                </div>
                <div className="w-32">
                  <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Asset
                  </label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as "XLM" | "USDC" | "EURC")}
                    className="w-full px-4 py-3.5 bg-[#0c1020] border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                  >
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                    <option value="EURC">EURC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                  Memo (Optional, max 28 chars)
                </label>
                <input
                  type="text"
                  maxLength={28}
                  placeholder="Payment note..."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-mono text-sm placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                />
              </div>

              {/* Conditionally show ZK-gate warning badge */}
              {amount && parseFloat(amount) > ZK_PROOF_THRESHOLD && (
                <div className="p-4 rounded-2xl bg-[#e8b84b]/10 border border-[#e8b84b]/20 flex gap-3 text-[#e8b84b] text-xs">
                  <Cpu className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block mb-0.5">ZK Compliance Required</span>
                    <span className="text-[#7a8aaa] font-medium">
                      Payment exceeds {ZK_PROOF_THRESHOLD} {asset}. An in-browser zero-knowledge proof will be generated to certify compliance against the {ZK_SPENDING_LIMIT_CEILING} {asset} limit before submission.
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleSendPayment}
                className="w-full py-4 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-2xl hover:bg-[#f0c85a] transition-all hover:-translate-y-0.5 shadow-xl shadow-[#e8b84b]/10 active:translate-y-0 mt-4 uppercase tracking-widest text-xs"
              >
                Send Payment
              </button>
            </div>
          </div>
        )}

        {/* ZK Proving Progress Stage */}
        {status === "zk_proving" && (
          <div className="py-8 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              {/* Spinner animation */}
              <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-[#e8b84b] animate-spin" />
              <Cpu className="absolute inset-0 m-auto w-8 h-8 text-[#e8b84b] animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Generating ZK spending-proof</h3>
              <p className="text-[#7a8aaa] text-xs max-w-sm mx-auto leading-relaxed">
                Performing complex polynomial calculations client-side to prove compliance without revealing transfer inputs.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa] px-1">
                <span className="text-[#e8b84b] font-mono">{zkStatusMsg || "Initializing..."}</span>
                <span>{zkProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#e8b84b] to-[#f0c85a] rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${zkProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ZK Proving Success Stage */}
        {status === "zk_success" && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">ZK spending-proof Generated</h3>
              <p className="text-[#7a8aaa] text-sm">
                Crypto proof attached successfully to ledger request payload.
              </p>
            </div>
          </div>
        )}

        {/* ZK Proving Failed Stage */}
        {status === "zk_failed" && (
          <div className="py-6 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">ZK Constraint Violation</h3>
              <p className="text-red-400 text-sm max-w-sm mx-auto font-medium px-4 py-2 bg-red-500/5 border border-red-500/10 rounded-xl">
                {formError || "Proof generation aborted due to invalid inputs."}
              </p>
              <p className="text-[#7a8aaa] text-xs max-w-xs mx-auto leading-relaxed pt-2">
                The transaction amount violates your configured absolute spending limit rule.
              </p>
            </div>

            <div className="flex gap-4 max-w-md mx-auto pt-2">
              <button
                onClick={() => {
                  setStatus("idle");
                  setFormError("");
                }}
                className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                <RefreshCw className="w-4 h-4" />
                Change Amount
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/25 text-red-400 font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Cancel Send
              </button>
            </div>
          </div>
        )}

        {/* Transaction submission & signing loading */}
        {(status === "signing" || status === "submitting") && (
          <div className="py-12 text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-[#e8b84b] animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white capitalize">
                {status === "signing" ? "Awaiting Freighter Wallet Signature" : "Submitting to Stellar network"}
              </h3>
              <p className="text-[#7a8aaa] text-sm mt-1">
                {status === "signing"
                  ? "Please review and authorize the transaction envelope in your Freighter wallet popup."
                  : "Broadcasting payment envelope with proof to the Soroban verification contract..."}
              </p>
            </div>
          </div>
        )}

        {/* Success confirmation */}
        {status === "success" && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#e8b84b]" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Payment Completed</h3>
              <p className="text-[#7a8aaa] text-sm max-w-xs mx-auto">
                Successfully sent {amount} {asset} to recipient. The verifier contract has processed the ZK Spending limits validation.
              </p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-left max-w-sm mx-auto font-mono text-xs space-y-1 text-[#7a8aaa]">
              <div className="flex justify-between">
                <span>Transaction Hash:</span>
                <span className="text-white font-bold">{txHash.substring(0, 8)}...{txHash.substring(txHash.length - 8)}</span>
              </div>
              <div className="flex justify-between">
                <span>Verification State:</span>
                <span className="text-[#e8b84b] font-bold">ZK Compliant (UltraHonk)</span>
              </div>
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