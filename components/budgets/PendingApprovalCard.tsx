"use client";

import {
  Check,
  Clock,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import type {
  PendingBudgetChange,
  SharedBudget,
} from "@/lib/api/client";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  amount: "Amount",
  category: "Category",
  asset: "Asset",
  startDate: "Start date",
  endDate: "End date",
};

function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface PendingApprovalCardProps {
  change: PendingBudgetChange;
  budget: SharedBudget;
  currentUser: string | null;
  onApprove: (changeId: string) => void;
  onReject: (changeId: string) => void;
  isSubmitting?: boolean;
}

export default function PendingApprovalCard({
  change,
  budget,
  currentUser,
  onApprove,
  onReject,
  isSubmitting = false,
}: PendingApprovalCardProps) {
  const isPending = change.status === "pending";
  const members = [budget.ownerAddress, ...budget.coOwners];
  const approvalsNeeded = Math.max(
    budget.approvalThreshold - change.approvals.length,
    0
  );
  const progressPercent = Math.min(
    Math.round((change.approvals.length / budget.approvalThreshold) * 100),
    100
  );
  const isMember = currentUser ? isMemberOf(budget, currentUser) : false;
  const hasSigned = currentUser
    ? change.approvals.includes(currentUser) ||
      change.rejections.includes(currentUser)
    : false;

  const changeSummary = Object.entries(FIELD_LABELS)
    .filter(([key]) => (change.changes as Record<string, unknown>)[key] !== undefined)
    .map(([key, label]) => {
      const value = (change.changes as Record<string, unknown>)[key];
      return (
        <div key={key} className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{label}</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {key === "amount" ? `${String(value)} ${budget.asset}` : String(value)}
          </span>
        </div>
      );
    });

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border ${
        isPending
          ? "border-amber-200 dark:border-amber-700"
          : change.status === "approved"
            ? "border-green-200 dark:border-green-700"
            : "border-red-200 dark:border-red-700"
      }`}
    >
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {change.type === "delete"
              ? "Delete budget"
              : change.type === "withdrawal"
                ? "Withdrawal"
                : "Proposed change"}{" "}
            · {change.budgetName}
          </h3>
        </div>
        {!isPending && (
          <span
            className={`inline-flex items-center space-x-1 text-xs font-semibold px-2 py-1 rounded-full ${
              change.status === "approved"
                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
            }`}
          >
            {change.status === "approved" ? (
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ShieldX className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {change.status === "approved"
                ? "Approved & applied"
                : "Rejected"}
            </span>
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        {change.description}
      </p>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Proposed by{" "}
        <span className="font-mono">{shortAddress(change.proposedBy)}</span> ·{" "}
        {formatTime(change.proposedAt)}
      </p>

      {changeSummary.length > 0 && (
        <div className="space-y-1 mb-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
          {changeSummary}
        </div>
      )}

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Approvals
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {change.approvals.length}/{budget.approvalThreshold} needed
          </span>
        </div>
        <div
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={change.approvals.length}
          aria-valuemin={0}
          aria-valuemax={budget.approvalThreshold}
          aria-label="Approval progress"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPending
                ? "bg-amber-500"
                : change.status === "approved"
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1.5 mb-4" aria-label="Co-owner signatures">
        {members.map((address) => {
          const approved = change.approvals.includes(address);
          const rejected = change.rejections.includes(address);
          const isCurrentUser = currentUser === address;
          return (
            <li
              key={address}
              className={`flex items-center justify-between text-sm ${
                isCurrentUser ? "text-blue-600 dark:text-blue-300" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <span className="flex items-center space-x-2">
                <span className="font-mono">{shortAddress(address)}</span>
                {isCurrentUser && (
                  <span className="text-[10px] uppercase tracking-wide bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                    you
                  </span>
                )}
              </span>
              {approved ? (
                <span className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                  <span className="text-xs">Approved</span>
                </span>
              ) : rejected ? (
                <span className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                  <UserX className="w-4 h-4" aria-hidden="true" />
                  <span className="text-xs">Rejected</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-gray-400 dark:text-gray-500">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span className="text-xs">Pending</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {isPending && (
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => onApprove(change.id)}
            disabled={!isMember || hasSigned || isSubmitting}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900/50 text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Approve</span>
          </button>
          <button
            type="button"
            onClick={() => onReject(change.id)}
            disabled={!isMember || hasSigned || isSubmitting}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 font-semibold rounded-lg transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span>Reject</span>
          </button>
        </div>
      )}

      {isPending && !isMember && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Only members of this shared budget can approve or reject changes.
        </p>
      )}

      {isPending && isMember && hasSigned && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {approvalsNeeded > 0
            ? `You've signed this change. ${approvalsNeeded} more approval${approvalsNeeded === 1 ? "" : "s"} needed.`
            : "Threshold reached — this change is being applied."}
        </p>
      )}
    </div>
  );
}

function isMemberOf(budget: SharedBudget, address: string): boolean {
  return budget.ownerAddress === address || budget.coOwners.includes(address);
}
