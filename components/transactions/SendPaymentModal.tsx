"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Send, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

import { useOffline } from "@/components/offline/OfflineProvider";
import { useToast } from "@/components/ui/use-toast";
import { getRemaining, recordSpend } from "@/lib/stellar/spendingLimitsContract";
import {
  fetchPaymentFee,
  PAYMENT_CONFIRMED_EVENT,
  PAYMENT_SUBMITTED_EVENT,
  type PaymentStatus,
  type PendingPayment,
} from "@/lib/stellar/submitTransaction";
import useWallet from "@/hooks/useWallet";
import type { PaymentAsset } from "@/lib/stellar/buildPaymentTransaction";

interface SendPaymentModalProps {
  onClose: () => void;
}

type ModalStatus = "idle" | PaymentStatus | "success" | "failed";

export default function SendPaymentModal({ onClose }: SendPaymentModalProps) {
  const { isOnline, queueAction } = useOffline();
  const { toast } = useToast();
  const { freighter, sendPayment } = useWallet();


  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<PaymentAsset>("XLM");
  const [memo, setMemo] = useState("");
  const [fee, setFee] = useState("100");
  const [feeLoading, setFeeLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    if (!freighter.isConnected) return;

    let cancelled = false;
    fetchPaymentFee()
      .then((networkFee) => {
        if (!cancelled) setFee(networkFee);
      })
      .catch(() => {
        // Keep the protocol minimum as a usable estimate if Horizon is unavailable.
      })
      .finally(() => {
        if (!cancelled) setFeeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [freighter.isConnected]);

  const validateInputs = () => {
    if (!freighter.isConnected || !freighter.publicKey) {
      setFormError("Connect Freighter before sending a payment.");
      return false;
    }
    if (!recipient.trim()) {
      setFormError("Recipient address is required.");
      return false;
    }
    if (!/^G[A-Z2-7]{55}$/.test(recipient.trim())) {
      setFormError("Recipient must be a valid 56-character Stellar public key.");
      return false;
    }
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
      setFormError("Amount must be greater than zero with no more than 7 decimal places.");
      return false;
    }
    if (memo && new TextEncoder().encode(memo).length > 28) {
      setFormError("Memo must be 28 bytes or fewer.");
      return false;
    }
    setFormError("");
    return true;
  };

  const handleSendPayment = async () => {
    if (!validateInputs()) return;
    const parsedAmount = amount;

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

    try {
      const limitInfo = await getRemaining(freighter.publicKey!, asset);
      if (limitInfo?.hasLimit && Number(parsedAmount) > limitInfo.remainingAmount) {
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


    try {
      setStatus("validating");
      const payment = await sendPayment({
        destination: recipient.trim(),
        amount: parsedAmount,
        asset,
        memo: memo || undefined,
        onStatus: setStatus,
        onSubmitted: (pendingPayment: PendingPayment) => {
          window.dispatchEvent(
            new CustomEvent(PAYMENT_SUBMITTED_EVENT, { detail: pendingPayment }),
          );
        },
      });

      await recordSpend(freighter.publicKey!, asset, Number(parsedAmount));
      setTxHash(payment.hash);
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

  const isBusy = status !== "idle" && status !== "success" && status !== "failed";
  const statusLabel: Record<PaymentStatus, string> = {
    validating: "Checking destination and balance",
    building: "Building payment transaction",
    signing: "Awaiting Freighter signature",
    submitting: "Submitting to Stellar",
    confirming: "Waiting for ledger confirmation",
    confirmed: "Payment confirmed",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#060813]/85 backdrop-blur-md"
        onClick={!isBusy ? onClose : undefined}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg rounded-[32px] bg-[#0c1020] border border-white/10 shadow-2xl p-8"
      >
        {!isBusy && (
          <button
            onClick={onClose}
            aria-label="Close send payment dialog"
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/10 text-[#7a8aaa] hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {status === "idle" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-2xl">
                <Send className="w-6 h-6 text-[#e8b84b]" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Send Assets</h2>
                <p className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider mt-0.5">
                  Stellar testnet payment
                </p>
              </div>
            </div>

            {formError && (
              <div role="alert" className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            {!freighter.isConnected && (
              <div className="mb-6 p-4 rounded-2xl bg-[#e8b84b]/10 border border-[#e8b84b]/20 text-[#e8b84b] text-sm">
                Connect Freighter to authorize this payment from your wallet.
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="payment-recipient" className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                  Recipient Stellar Address
                </label>
                <input
                  id="payment-recipient"
                  type="text"
                  placeholder="G..."
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value.trimStart())}
                  autoComplete="off"
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-mono text-sm placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="payment-amount" className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Amount
                  </label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.0000001"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-bold placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                  />
                </div>
                <div className="w-32">
                  <label htmlFor="payment-asset" className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                    Asset
                  </label>
                  <select
                    id="payment-asset"
                    value={asset}
                    onChange={(event) => setAsset(event.target.value as PaymentAsset)}
                    className="w-full px-4 py-3.5 bg-[#0c1020] border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                  >
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                    <option value="EURC">EURC</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="payment-memo" className="text-[#7a8aaa] text-[10px] font-black uppercase tracking-[0.2em] mb-2 block">
                  Memo (Optional, max 28 bytes)
                </label>
                <input
                  id="payment-memo"
                  type="text"
                  maxLength={28}
                  placeholder="Payment note..."
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-mono text-sm placeholder-[#7a8aaa]/40 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/30 focus:border-[#e8b84b]/40 transition-all"
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm">
                <span className="text-[#7a8aaa]">Estimated network fee</span>
                <span className="font-mono font-bold text-white">
                  {feeLoading ? "Loading..." : `${(Number(fee) / 10_000_000).toFixed(7)} XLM`}
                </span>
              </div>

              <button
                onClick={handleSendPayment}
                className="w-full py-4 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-2xl hover:bg-[#f0c85a] transition-all shadow-xl shadow-[#e8b84b]/10 uppercase tracking-widest text-xs"
              >
                Sign and Send Payment
              </button>
            </div>
          </div>
        )}

        {isBusy && (
          <div className="py-12 text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-[#e8b84b] animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{statusLabel[status as PaymentStatus]}</h3>
              <p className="text-[#7a8aaa] text-sm mt-2">
                {status === "signing"
                  ? "Review the transaction details in the Freighter popup."
                  : "Keep this window open while the payment is processed."}
              </p>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="py-8 text-center space-y-6">
            <AlertTriangle className="w-14 h-14 mx-auto text-red-400" />
            <div>
              <h3 className="text-2xl font-black text-white">Payment failed</h3>
              <p role="alert" className="text-red-400 text-sm mt-3">{formError}</p>
            </div>
            <button
              onClick={() => {
                setStatus("idle");
                setFormError("");
              }}
              className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="py-8 text-center space-y-6">
            <CheckCircle2 className="w-16 h-16 mx-auto text-[#4ade80]" />
            <div>
              <h3 className="text-2xl font-black text-white">Payment confirmed</h3>
              <p className="text-[#7a8aaa] text-sm mt-2">
                {amount} {asset} is now on its way to the destination account.
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 text-left">
              <span className="text-[10px] uppercase tracking-widest text-[#7a8aaa]">Transaction hash</span>
              <p className="mt-2 break-all font-mono text-xs text-white">{txHash}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}