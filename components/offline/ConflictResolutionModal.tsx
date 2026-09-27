"use client";

import React, { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import {
  labelForField,
  type ConflictPrompt,
  type ConflictResolution,
} from "./actionHandlers";

/**
 * ConflictResolutionModal
 *
 * Shown when a change saved on this device while offline turns out to clash
 * with a change made somewhere else. The copy is deliberately plain — no
 * version or merge terminology — because the app is built for people who just
 * want to know "which one do I keep?".
 */

const RECORD_KIND: Record<string, string> = {
  UPDATE_BUDGET: "budget",
  UPDATE_GOAL: "savings goal",
  UPDATE_SHARED_BUDGET: "shared budget",
  UPDATE_SPLIT_BILL: "split bill",
};

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not set";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export interface ConflictResolutionModalProps {
  prompt: ConflictPrompt;
  isSubmitting?: boolean;
  onResolve: (resolution: ConflictResolution) => void | Promise<void>;
  onDismiss?: () => void;
}

export default function ConflictResolutionModal({
  prompt,
  isSubmitting = false,
  onResolve,
  onDismiss,
}: ConflictResolutionModalProps) {
  const [mode, setMode] = useState<"simple" | "choose">("simple");
  const [choices, setChoices] = useState<Record<string, "mine" | "theirs">>(() => {
    const initial: Record<string, "mine" | "theirs"> = {};
    for (const conflict of prompt.detection.conflicts) {
      initial[conflict.field] = "mine";
    }
    return initial;
  });

  const kind = RECORD_KIND[prompt.type] ?? "budget";
  const conflictCount = prompt.detection.conflicts.length;

  const resolve = (resolution: ConflictResolution) => {
    void onResolve(resolution);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-resolution-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-[#060813]/85 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px] bg-[#0c1020] border border-white/10 shadow-2xl p-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#e8b84b]/10 blur-[60px] pointer-events-none" />

        <div className="relative flex items-start gap-3 mb-5">
          <div className="p-3 bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-2xl shrink-0">
            <AlertTriangle className="w-6 h-6 text-[#e8b84b]" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="conflict-resolution-title"
              className="text-2xl font-black text-white tracking-tight"
            >
              Two devices made different changes
            </h2>
            <p className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider mt-1">
              Nothing has been saved yet
            </p>
          </div>
        </div>

        <p className="relative text-sm text-[#c8d0e0] mb-5">
          While you were offline, you changed the{" "}
          <span className="font-semibold text-white">{kind}</span>{" "}
          <span className="font-semibold text-white">&ldquo;{prompt.label}&rdquo;</span>. It
          was also changed on another device before yours reconnected, so we
          need to know which change you want to keep. Your other saved changes
          are safe either way.
        </p>

        <div className="relative space-y-3 mb-6">
          {prompt.detection.conflicts.map((conflict) => {
            const label = labelForField(conflict.field);
            const mine = formatValue(conflict.mine);
            const theirs = formatValue(conflict.theirs);
            const selected = mode === "choose" ? choices[conflict.field] : null;

            return (
              <div
                key={conflict.field}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7a8aaa] mb-3">
                  {label}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {mode === "choose" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setChoices((prev) => ({ ...prev, [conflict.field]: "mine" }))
                        }
                        aria-pressed={selected === "mine"}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${
                          selected === "mine"
                            ? "border-[#e8b84b]/60 bg-[#e8b84b]/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/25"
                        }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
                          This device
                        </span>
                        <span className="block text-sm font-semibold text-white break-words">
                          {mine}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setChoices((prev) => ({ ...prev, [conflict.field]: "theirs" }))
                        }
                        aria-pressed={selected === "theirs"}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${
                          selected === "theirs"
                            ? "border-[#e8b84b]/60 bg-[#e8b84b]/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/25"
                        }`}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
                          Other device
                        </span>
                        <span className="block text-sm font-semibold text-white break-words">
                          {theirs}
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
                          Your change
                        </span>
                        <span className="block text-sm font-semibold text-white break-words">
                          {mine}
                        </span>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">
                          Other device
                        </span>
                        <span className="block text-sm font-semibold text-white break-words">
                          {theirs}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {mode === "simple" ? (
          <div className="relative space-y-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => resolve({ strategy: "keep_mine" })}
              className="w-full py-4 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-2xl hover:bg-[#f0c85a] transition-all uppercase tracking-widest text-xs disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Keep what I changed"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => resolve({ strategy: "keep_theirs" })}
              className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs disabled:opacity-60"
            >
              Keep the other change
            </button>
            {conflictCount > 1 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setMode("choose")}
                className="w-full py-3 text-[#7a8aaa] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-60"
              >
                Choose one by one
              </button>
            )}
          </div>
        ) : (
          <div className="relative space-y-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                resolve({ strategy: "choose_fields", choices: { ...choices } })
              }
              className="w-full py-4 bg-[#e8b84b] text-[#1a0f00] font-bold rounded-2xl hover:bg-[#f0c85a] transition-all uppercase tracking-widest text-xs disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {isSubmitting ? "Saving..." : "Save my choice"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setMode("simple")}
              className="w-full py-3 text-[#7a8aaa] hover:text-white text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-60"
            >
              Back
            </button>
          </div>
        )}

        {onDismiss && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onDismiss}
            className="relative mt-4 w-full text-center text-[10px] font-semibold uppercase tracking-widest text-[#7a8aaa] hover:text-white transition-colors disabled:opacity-60"
          >
            Decide later
          </button>
        )}
      </div>
    </div>
  );
}
