/**
 * Real-time on-chain notification triggers (#104)
 *
 * Client-side detection logic for:
 * - Budget threshold alerts (80% and 100% spending milestones)
 * - Goal milestone notifications (25%, 50%, 75%, 100% completion)
 * - Large/unusual payment detection (incoming and outgoing)
 *
 * Features:
 * - Per-wallet state management (notification history per wallet)
 * - De-duplication (prevent duplicate notifications for same event)
 * - Adapter pattern for on-chain event bus or client-side derivation
 */

import type { Budget, Transaction } from "@/lib/api/client";
import type { Goal } from "@/lib/types/savings";

// Storage keys
const NOTIFICATION_STATE_PREFIX = "stellarspend_notification_state_";
const TRIGGERED_EVENTS_PREFIX = "stellarspend_triggered_events_";

// Thresholds
const BUDGET_THRESHOLDS = [80, 100] as const;
const GOAL_MILESTONES = [25, 50, 75, 100] as const;
const LARGE_PAYMENT_THRESHOLD_XLM = 1000;
const LARGE_PAYMENT_THRESHOLD_USD = 500;

export type NotificationType = "success" | "error" | "info";

export interface NotificationTrigger {
  type: NotificationType;
  message: string;
  eventKey: string; // Unique key for de-duplication
  timestamp: number;
}

interface BudgetSpending {
  budgetId: string;
  spent: number;
  limit: number;
}

interface WalletNotificationState {
  walletId: string;
  lastCheckedAt: number;
  budgetSpending: Record<string, BudgetSpending>;
  goalProgress: Record<string, number>;
  lastKnownBalance: number;
}

/**
 * Get notification state for a specific wallet
 */
function getWalletState(walletId: string): WalletNotificationState {
  if (typeof window === "undefined") {
    return createEmptyState(walletId);
  }

  const stored = localStorage.getItem(NOTIFICATION_STATE_PREFIX + walletId);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return createEmptyState(walletId);
    }
  }
  return createEmptyState(walletId);
}

/**
 * Save notification state for a specific wallet
 */
function saveWalletState(state: WalletNotificationState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    NOTIFICATION_STATE_PREFIX + state.walletId,
    JSON.stringify(state)
  );
}

/**
 * Get triggered events set for de-duplication
 */
function getTriggeredEvents(walletId: string): Set<string> {
  if (typeof window === "undefined") return new Set();

  const stored = localStorage.getItem(TRIGGERED_EVENTS_PREFIX + walletId);
  if (stored) {
    try {
      return new Set(JSON.parse(stored));
    } catch {
      return new Set();
    }
  }
  return new Set();
}

/**
 * Mark an event as triggered (for de-duplication)
 */
function markEventTriggered(walletId: string, eventKey: string): void {
  if (typeof window === "undefined") return;

  const events = getTriggeredEvents(walletId);
  events.add(eventKey);

  // Keep only last 1000 events to prevent unbounded growth
  const eventsArray = Array.from(events);
  if (eventsArray.length > 1000) {
    eventsArray.splice(0, eventsArray.length - 1000);
  }

  localStorage.setItem(
    TRIGGERED_EVENTS_PREFIX + walletId,
    JSON.stringify(eventsArray)
  );
}

/**
 * Check if an event has already been triggered
 */
function isEventTriggered(walletId: string, eventKey: string): boolean {
  return getTriggeredEvents(walletId).has(eventKey);
}

function createEmptyState(walletId: string): WalletNotificationState {
  return {
    walletId,
    lastCheckedAt: 0,
    budgetSpending: {},
    goalProgress: {},
    lastKnownBalance: 0,
  };
}

/**
 * Checks budget spending against the configured thresholds (80% and 100%) and
 * generates a notification trigger for each threshold newly crossed.
 *
 * Thresholds already triggered for a budget are skipped via the persisted
 * de-duplication state, which is updated along with the latest spending figures.
 *
 * @param walletId - Identifier of the wallet whose notification state is used for de-duplication.
 * @param budgets - Budgets to evaluate, each providing a spending `limit` and name.
 * @param spendingByBudget - Amount spent per budget, keyed by budget id.
 * @returns The notification triggers for thresholds crossed since the previous check; empty if none were crossed.
 */
export function checkBudgetThresholds(
  walletId: string,
  budgets: Budget[],
  spendingByBudget: Record<string, number>
): NotificationTrigger[] {
  const triggers: NotificationTrigger[] = [];
  const state = getWalletState(walletId);

  for (const budget of budgets) {
    const spent = spendingByBudget[budget.id] || 0;
    const limit = budget.amount;
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;

    // Check each threshold
    for (const threshold of BUDGET_THRESHOLDS) {
      const eventKey = `budget_${budget.id}_${threshold}`;

      // Skip if already triggered
      if (isEventTriggered(walletId, eventKey)) {
        continue;
      }

      // Check if threshold crossed
      const prevSpent = state.budgetSpending[budget.id]?.spent || 0;
      const prevPercentage = limit > 0 ? (prevSpent / limit) * 100 : 0;

      if (percentage >= threshold && prevPercentage < threshold) {
        const trigger: NotificationTrigger = {
          type: threshold === 100 ? "error" : "info",
          message:
            threshold === 100
              ? `Budget "${budget.name}" has reached 100%! You've spent ${spent.toFixed(2)} ${budget.asset} of your ${limit.toFixed(2)} ${budget.asset} limit.`
              : `Budget "${budget.name}" is at ${threshold}%. You've spent ${spent.toFixed(2)} ${budget.asset} of your ${limit.toFixed(2)} ${budget.asset} limit.`,
          eventKey,
          timestamp: Date.now(),
        };

        triggers.push(trigger);
        markEventTriggered(walletId, eventKey);
      }
    }

    // Update state
    state.budgetSpending[budget.id] = { budgetId: budget.id, spent, limit };
  }

  state.lastCheckedAt = Date.now();
  saveWalletState(state);

  return triggers;
}

/**
 * Checks savings goal progress against the milestone percentages (25%, 50%,
 * 75% and 100%) and generates a notification trigger for each milestone newly
 * reached.
 *
 * Milestones already triggered for a goal are skipped via the persisted
 * de-duplication state, which is updated along with the latest progress.
 *
 * @param walletId - Identifier of the wallet whose notification state is used for de-duplication.
 * @param goals - Savings goals to evaluate, each providing `currentAmount` and `targetAmount`.
 * @returns The notification triggers for milestones reached since the previous check; empty if none were reached.
 */
export function checkGoalMilestones(
  walletId: string,
  goals: Goal[]
): NotificationTrigger[] {
  const triggers: NotificationTrigger[] = [];
  const state = getWalletState(walletId);

  for (const goal of goals) {
    const progress =
      goal.targetAmount > 0
        ? (goal.currentAmount / goal.targetAmount) * 100
        : 0;

    // Check each milestone
    for (const milestone of GOAL_MILESTONES) {
      const eventKey = `goal_${goal.id}_${milestone}`;

      // Skip if already triggered
      if (isEventTriggered(walletId, eventKey)) {
        continue;
      }

      // Check if milestone crossed
      const prevProgress = state.goalProgress[goal.id] || 0;

      if (progress >= milestone && prevProgress < milestone) {
        const trigger: NotificationTrigger = {
          type: milestone === 100 ? "success" : "info",
          message:
            milestone === 100
              ? `Congratulations! You've reached your goal "${goal.name}"! Target of ${goal.targetAmount.toFixed(2)} achieved.`
              : `Goal "${goal.name}" is ${milestone}% complete! Current: ${goal.currentAmount.toFixed(2)} / Target: ${goal.targetAmount.toFixed(2)}`,
          eventKey,
          timestamp: Date.now(),
        };

        triggers.push(trigger);
        markEventTriggered(walletId, eventKey);
      }
    }

    // Update state
    state.goalProgress[goal.id] = progress;
  }

  state.lastCheckedAt = Date.now();
  saveWalletState(state);

  return triggers;
}

/**
 * Checks transactions for large payment operations involving the given wallet.
 *
 * A payment qualifies when its amount is at least 1000 for XLM (or an asset
 * with no code) or at least 500 for other assets. Only incoming and outgoing
 * operations relative to `publicKey` produce triggers, and events already
 * triggered are skipped via the persisted de-duplication state.
 *
 * @param walletId - Identifier of the wallet whose notification state is used for de-duplication.
 * @param transactions - Transactions to scan, including their payment operations.
 * @param publicKey - Stellar public key of the wallet, used to determine payment direction.
 * @returns The notification triggers for qualifying payments not previously triggered; empty if none qualified.
 */
export function checkLargePayments(
  walletId: string,
  transactions: Transaction[],
  publicKey: string
): NotificationTrigger[] {
  const triggers: NotificationTrigger[] = [];

  for (const tx of transactions) {
    // Check each operation in the transaction
    for (const op of tx.operations) {
      if (op.type !== "payment" && op.type !== "path_payment_strict_receive") {
        continue;
      }

      const amount = parseFloat(op.amount || "0");
      const isIncoming = op.to === publicKey;
      const isOutgoing = op.from === publicKey;

      // Determine threshold based on asset
      const threshold =
        op.asset_code === "XLM" || !op.asset_code
          ? LARGE_PAYMENT_THRESHOLD_XLM
          : LARGE_PAYMENT_THRESHOLD_USD;

      if (amount >= threshold) {
        const eventKey = `large_payment_${tx.id}_${op.id}`;

        // Skip if already triggered
        if (isEventTriggered(walletId, eventKey)) {
          continue;
        }

        const asset = op.asset_code || "XLM";
        const direction = isIncoming ? "received" : isOutgoing ? "sent" : "";

        if (direction) {
          const trigger: NotificationTrigger = {
            type: isIncoming ? "success" : "info",
            message: isIncoming
              ? `Large payment received: ${amount.toFixed(2)} ${asset} from ${truncateAddress(op.from || "")}`
              : `Large payment sent: ${amount.toFixed(2)} ${asset} to ${truncateAddress(op.to || "")}`,
            eventKey,
            timestamp: Date.now(),
          };

          triggers.push(trigger);
          markEventTriggered(walletId, eventKey);
        }
      }
    }
  }

  return triggers;
}

/**
 * Helper to truncate Stellar addresses for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Clears all persisted notification state for a wallet, including its budget
 * and goal progress and the set of triggered events (useful for testing or a
 * full reset). This is a no-op when `window` is unavailable (server-side).
 *
 * @param walletId - Identifier of the wallet whose notification state is removed.
 * @returns Nothing.
 */
export function clearWalletNotificationState(walletId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NOTIFICATION_STATE_PREFIX + walletId);
  localStorage.removeItem(TRIGGERED_EVENTS_PREFIX + walletId);
}

/**
 * Removes previously triggered event keys for a category so the corresponding
 * notifications can fire again (useful when a budget is reset or a goal is
 * modified). This is a no-op when `window` is unavailable (server-side).
 *
 * @param walletId - Identifier of the wallet whose triggered events are reset.
 * @param prefix - Event category to reset (`"budget"`, `"goal"` or `"large_payment"`).
 * @param entityId - Optional entity id (budget or goal) to limit the reset to a single entity; when omitted, all events for the category are removed.
 * @returns Nothing.
 */
export function resetTriggeredEvents(
  walletId: string,
  prefix: "budget" | "goal" | "large_payment",
  entityId?: string
): void {
  if (typeof window === "undefined") return;

  const events = getTriggeredEvents(walletId);
  const pattern = entityId ? `${prefix}_${entityId}_` : `${prefix}_`;

  const filtered = Array.from(events).filter(
    (event) => !event.startsWith(pattern)
  );

  localStorage.setItem(
    TRIGGERED_EVENTS_PREFIX + walletId,
    JSON.stringify(filtered)
  );
}

/**
 * Runs every trigger check (budget thresholds, goal milestones and large
 * payments) and returns the combined result. Intended to be called
 * periodically or after data updates.
 *
 * @param walletId - Identifier of the wallet whose notification state is used for de-duplication.
 * @param publicKey - Stellar public key of the wallet, used to determine payment direction.
 * @param budgets - Budgets to evaluate for threshold alerts.
 * @param spendingByBudget - Amount spent per budget, keyed by budget id.
 * @param goals - Savings goals to evaluate for milestone notifications.
 * @param recentTransactions - Recent transactions to scan for large payments.
 * @returns All notification triggers produced by the individual checks, in budget, goal, then payment order.
 */
export function checkAllTriggers(
  walletId: string,
  publicKey: string,
  budgets: Budget[],
  spendingByBudget: Record<string, number>,
  goals: Goal[],
  recentTransactions: Transaction[]
): NotificationTrigger[] {
  const allTriggers: NotificationTrigger[] = [];

  // Check budget thresholds
  const budgetTriggers = checkBudgetThresholds(
    walletId,
    budgets,
    spendingByBudget
  );
  allTriggers.push(...budgetTriggers);

  // Check goal milestones
  const goalTriggers = checkGoalMilestones(walletId, goals);
  allTriggers.push(...goalTriggers);

  // Check large payments
  const paymentTriggers = checkLargePayments(
    walletId,
    recentTransactions,
    publicKey
  );
  allTriggers.push(...paymentTriggers);

  return allTriggers;
}

/**
 * Dispatches each trigger to the notification context via the supplied
 * callback, forwarding the trigger's type and message.
 *
 * @param triggers - Notification triggers to dispatch.
 * @param addNotification - Callback that adds a single notification for a given type and message.
 * @returns Nothing.
 */
export function dispatchTriggers(
  triggers: NotificationTrigger[],
  addNotification: (type: NotificationType, message: string) => void
): void {
  for (const trigger of triggers) {
    addNotification(trigger.type, trigger.message);
  }
}
