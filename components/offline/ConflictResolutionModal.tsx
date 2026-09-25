"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import type {
  ConflictPrompt,
  ConflictResolution,
  VersionedUpdateType,
} from "./actionHandlers";

/**
 * Plain-language conflict resolution dialog (Issue #115).
 *
 * Deliberately avoids version-control vocabulary: the user sees which values
 * differ and picks what to keep. Nothing is written until they decide.
 */

const ENTITY_LABELS: Record<VersionedUpdateType, string> = {
  UPDATE_BUDGET: "budget",
  UPDATE_GOAL: "savings goal",
  UPDATE_SHARED_BUDGET: "shared budget",
  UPDATE_SPLIT_BILL: "split bill",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Name",
  amount: "Amount",
  totalAmount: "Total amount",
  targetAmount: "Target amount",
  currentAmount: "Saved so far",
  category: "Category",
  asset: "Currency",
  startDate: "Start date",
  endDate: "End date",
  deadline: "Deadline",
  recurrence: "Repeats",
  note: "Note",
  description: "Description",
  participants: "People sharing",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?$/;

function titleCaseFromKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? titleCaseFromKey(field);
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
      : String(value);
  }
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
        }).format(parsed);
      }
    }
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface ConflictResolutionModalProps {
  conflict: ConflictPrompt;
  onResolve: (resolution: ConflictResolution) => void;
  /** Keep the change queued and ask again later. */
  onDecideLater?: () => void;
}

export default function ConflictResolutionModal({
  conflict,
  onResolve,
  onDecideLater,
}: ConflictResolutionModalProps) {
  const { detection } = conflict;
  const fields = detection.conflicts;

  const [choices, setChoices] = useState<Record<string, "mine" | "theirs">>(() =>
    Object.fromEntries(fields.map((field) => [field.field, "theirs" as const])),
  );

  useEffect(() => {
    if (!onDecideLater) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDecideLater();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDecideLater]);

  const entity = ENTITY_LABELS[conflict.type];
  const titleId = `conflict-title-${conflict.actionId}`;
  const descriptionId = `conflict-description-${conflict.actionId}`;

  const autoMergedDescription = useMemo(() => {
    const names = detection.autoMergedFields.map(fieldLabel);
    if (names.length === 0) return null;
    if (names.length === 1) {
      return `Your change to ${names[0]} doesn't clash with the other device, so it will be saved automatically.`;
    }
    return `Your changes to ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} don't clash with the other device, so they will be saved automatically.`;
  }, [detection.autoMergedFields]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-60"
        onClick={onDecideLater}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/40">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </span>
          <div>
            <h2
              id={titleId}
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              This {entity} was changed in two places
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm text-gray-600 dark:text-gray-300"
            >
              You changed “{conflict.label}” on this device while you were
              offline, and it was also changed somewhere else. Choose what to
              keep — nothing is saved until you decide.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((field) => (
            <fieldset
              key={field.field}
              className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {fieldLabel(field.field)}
              </legend>

              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    name={`choice-${conflict.actionId}-${field.field}`}
                    value="mine"
                    checked={choices[field.field] === "mine"}
                    onChange={() =>
                      setChoices((previous) => ({
                        ...previous,
                        [field.field]: "mine",
                      }))
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Keep what I changed: </span>
                    {formatFieldValue(field.mine)}
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    name={`choice-${conflict.actionId}-${field.field}`}
                    value="theirs"
                    checked={choices[field.field] !== "mine"}
                    onChange={() =>
                      setChoices((previous) => ({
                        ...previous,
                        [field.field]: "theirs",
                      }))
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Keep what’s saved: </span>
                    {formatFieldValue(field.theirs)}
                  </span>
                </label>
              </div>
            </fieldset>
          ))}
        </div>

        {autoMergedDescription && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
            {autoMergedDescription}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {onDecideLater && (
            <button
              type="button"
              onClick={onDecideLater}
              className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Decide later
            </button>
          )}
          <button
            type="button"
            onClick={() => onResolve({ strategy: "keep_theirs" })}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Keep all saved values
          </button>
          <button
            type="button"
            onClick={() => onResolve({ strategy: "keep_mine" })}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Keep all my values
          </button>
          <button
            type="button"
            onClick={() =>
              onResolve({ strategy: "choose_fields", choices })
            }
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Save my choices
          </button>
        </div>
      </div>
    </div>
  );
}
