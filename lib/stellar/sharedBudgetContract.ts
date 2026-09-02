import { StrKey } from '@stellar/stellar-sdk';
import { Budget } from '@/lib/api/client';
import {
  callContractView,
  submitContractTx,
  triggerNotification,
} from './budgetContract';

const SHARED_BUDGET_CONTRACT_ID =
  process.env.NEXT_PUBLIC_SHARED_BUDGET_CONTRACT_ID || '';

const SHARED_BUDGETS_KEY = 'stellarspend_shared_budgets';
const PENDING_CHANGES_KEY = 'stellarspend_pending_changes';
const SHARED_BUDGETS_CHANNEL_NAME = 'stellarspend_shared_budgets_channel';

/** Type of change that can be proposed against a shared budget. */
export type SharedBudgetChangeType = 'update' | 'withdrawal' | 'delete';

/** Lifecycle of a proposed change. */
export type SharedBudgetChangeStatus = 'pending' | 'approved' | 'rejected';

/** A shared/household budget that requires co-owner approval for changes. */
export interface SharedBudget extends Budget {
  /** Address of the wallet that created the budget (the owner). */
  ownerAddress: string;
  /** Co-owner Stellar addresses (excluding the owner). */
  coOwners: string[];
  /** Number of member approvals required before a change is applied. */
  approvalThreshold: number;
  isShared: true;
}

/** Data required to create a shared budget. */
export interface SharedBudgetInput {
  name: string;
  amount: number;
  category: string;
  asset: Budget['asset'];
  startDate: string;
  endDate: string;
  coOwners: string[];
  approvalThreshold: number;
}

/** A proposed change to a shared budget that is awaiting co-owner approval. */
export interface PendingBudgetChange {
  id: string;
  budgetId: string;
  budgetName: string;
  type: SharedBudgetChangeType;
  description: string;
  proposedBy: string;
  proposedAt: string;
  /** Partial budget fields that will be applied once approved. */
  changes: Partial<Pick<SharedBudget, 'name' | 'amount' | 'category' | 'asset' | 'startDate' | 'endDate'>>;
  /** Member addresses that have approved (the proposer is auto-included). */
  approvals: string[];
  /** Member addresses that have rejected. */
  rejections: string[];
  status: SharedBudgetChangeStatus;
  resolvedAt?: string;
}

// ─── Local (mock) storage ─────────────────────────────────────────────────

export function getMockSharedBudgetsFallback(): SharedBudget[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SHARED_BUDGETS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse mock shared budgets', e);
    }
  }
  return [];
}

export function setMockSharedBudgetsFallback(budgets: SharedBudget[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SHARED_BUDGETS_KEY, JSON.stringify(budgets));
  }
}

export function getMockPendingChangesFallback(): PendingBudgetChange[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(PENDING_CHANGES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse mock pending changes', e);
    }
  }
  return [];
}

export function setMockPendingChangesFallback(changes: PendingBudgetChange[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(changes));
  }
}

// ─── Validation / helpers ─────────────────────────────────────────────────

/** Returns true when the address is a syntactically valid Stellar public key. */
export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/** Returns true when the address is the owner or a co-owner of the budget. */
export function isSharedBudgetMember(
  budget: SharedBudget,
  address: string
): boolean {
  return budget.ownerAddress === address || budget.coOwners.includes(address);
}

const BUDGET_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  amount: 'Amount',
  category: 'Category',
  asset: 'Asset',
  startDate: 'Start date',
  endDate: 'End date',
};

/**
 * Builds a human-readable description of the fields that would change,
 * e.g. "Amount: 500 → 750 USDC; Name: Groceries → Household".
 */
export function describeBudgetChanges(
  budget: SharedBudget,
  changes: Partial<Pick<SharedBudget, 'name' | 'amount' | 'category' | 'asset' | 'startDate' | 'endDate'>>
): string {
  const parts: string[] = [];
  for (const [key, label] of Object.entries(BUDGET_FIELD_LABELS)) {
    const next = (changes as Record<string, unknown>)[key];
    if (next === undefined) continue;
    const prev = (budget as unknown as Record<string, unknown>)[key];
    if (String(prev) === String(next)) continue;
    if (key === 'amount') {
      parts.push(`${label}: ${String(prev)} → ${String(next)} ${budget.asset}`);
    } else {
      parts.push(`${label}: ${String(prev)} → ${String(next)}`);
    }
  }
  return parts.length > 0 ? parts.join('; ') : 'Budget update';
}

function applyPendingChange(budget: SharedBudget, change: PendingBudgetChange) {
  const allowedKeys = ['name', 'amount', 'category', 'asset', 'startDate', 'endDate'];
  for (const key of allowedKeys) {
    const value = (change.changes as Record<string, unknown>)[key];
    if (value !== undefined) {
      (budget as unknown as Record<string, unknown>)[key] = value;
    }
  }
  budget.updatedAt = new Date().toISOString();
}

// ─── Realtime sync (streaming across co-owner sessions) ───────────────────

let channel: BroadcastChannel | null = null;

/** Broadcasts a change notification to other open sessions. */
export function notifySharedBudgetsChanged(): void {
  if (typeof BroadcastChannel !== 'undefined' && channel) {
    try {
      channel.postMessage('sync');
    } catch {
      // Ignore — polling/storage events will pick up the change.
    }
  }
}

/**
 * Subscribes to shared-budget updates across co-owner sessions without
 * requiring a manual refresh. Uses three complementary mechanisms:
 *   1. `BroadcastChannel` — same-origin tabs/contexts, delivered instantly.
 *   2. `storage` events — fired in other tabs whenever the shared stores change.
 *   3. Polling — fallback for sessions on other devices (and for contract mode).
 *
 * Returns an unsubscribe function.
 */
export function subscribeToSharedBudgets(
  onUpdate: () => void,
  options?: { pollIntervalMs?: number; enablePolling?: boolean }
): () => void {
  const pollIntervalMs = options?.pollIntervalMs ?? 5000;
  const enablePolling =
    options?.enablePolling ?? !SHARED_BUDGET_CONTRACT_ID;

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(SHARED_BUDGETS_CHANNEL_NAME);
      channel.onmessage = () => onUpdate();
    } catch {
      channel = null;
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === SHARED_BUDGETS_KEY ||
      event.key === PENDING_CHANGES_KEY ||
      event.key === null
    ) {
      onUpdate();
    }
  };
  window.addEventListener('storage', onStorage);

  let timer: ReturnType<typeof setInterval> | null = null;
  if (enablePolling) {
    timer = setInterval(onUpdate, pollIntervalMs);
  }

  return () => {
    try {
      channel?.close();
    } catch {
      // ignore
    }
    channel = null;
    window.removeEventListener('storage', onStorage);
    if (timer) clearInterval(timer);
  };
}

// ─── Data access ──────────────────────────────────────────────────────────

function normalizeSharedBudget(raw: Record<string, unknown>): SharedBudget | null {
  const id = raw.id;
  if (typeof id !== 'string') return null;
  const budget: SharedBudget = {
    id,
    name: String(raw.name ?? ''),
    amount: Number(raw.amount ?? 0),
    category: String(raw.category ?? ''),
    asset: (raw.asset as SharedBudget['asset']) ?? 'XLM',
    startDate: String(raw.start_date ?? raw.startDate ?? ''),
    endDate: String(raw.end_date ?? raw.endDate ?? ''),
    createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? new Date().toISOString()),
    ownerAddress: String(raw.owner_address ?? raw.ownerAddress ?? ''),
    coOwners: (() => {
      const coOwnersRaw = raw.co_owners ?? raw.coOwners;
      return Array.isArray(coOwnersRaw) ? coOwnersRaw.map(String) : [];
    })(),
    approvalThreshold: Number(raw.approval_threshold ?? raw.approvalThreshold ?? 1),
    isShared: true,
  };
  return budget;
}

function normalizePendingChange(raw: Record<string, unknown>): PendingBudgetChange | null {
  const id = raw.id;
  if (typeof id !== 'string') return null;
  return {
    id,
    budgetId: String(raw.budget_id ?? raw.budgetId ?? ''),
    budgetName: String(raw.budget_name ?? raw.budgetName ?? ''),
    type: (raw.type as PendingBudgetChange['type']) ?? 'update',
    description: String(raw.description ?? ''),
    proposedBy: String(raw.proposed_by ?? raw.proposedBy ?? ''),
    proposedAt: String(raw.proposed_at ?? raw.proposedAt ?? new Date().toISOString()),
    changes: (raw.changes as PendingBudgetChange['changes']) ?? {},
    approvals: Array.isArray(raw.approvals) ? raw.approvals.map(String) : [],
    rejections: Array.isArray(raw.rejections) ? raw.rejections.map(String) : [],
    status: (raw.status as PendingBudgetChange['status']) ?? 'pending',
    resolvedAt: raw.resolved_at
      ? String(raw.resolved_at)
      : raw.resolvedAt
        ? String(raw.resolvedAt)
        : undefined,
  };
}

/** Fetches shared budgets the given wallet is a member of. */
export async function fetchSharedBudgets(
  publicKey?: string | null
): Promise<SharedBudget[]> {
  if (SHARED_BUDGET_CONTRACT_ID && publicKey) {
    try {
      const raw = await callContractView<Array<Record<string, unknown>>>(
        publicKey,
        SHARED_BUDGET_CONTRACT_ID,
        'get_shared_budgets',
        [publicKey]
      );
      if (Array.isArray(raw)) {
        const budgets = raw
          .map((b) => normalizeSharedBudget(b))
          .filter((b): b is SharedBudget => b !== null);
        if (budgets.length > 0) return budgets;
      }
    } catch (e) {
      console.error(
        'Failed to fetch shared budgets on-chain. Falling back to local storage.',
        e
      );
    }
  }
  const all = getMockSharedBudgetsFallback();
  if (!publicKey) return all;
  return all.filter((b) => isSharedBudgetMember(b, publicKey));
}

/** Fetches pending changes for budgets the given wallet is a member of. */
export async function fetchPendingChanges(
  publicKey?: string | null
): Promise<PendingBudgetChange[]> {
  if (SHARED_BUDGET_CONTRACT_ID && publicKey) {
    try {
      const raw = await callContractView<Array<Record<string, unknown>>>(
        publicKey,
        SHARED_BUDGET_CONTRACT_ID,
        'get_pending_changes',
        [publicKey]
      );
      if (Array.isArray(raw)) {
        const changes = raw
          .map((c) => normalizePendingChange(c))
          .filter((c): c is PendingBudgetChange => c !== null);
        if (changes.length > 0) return changes;
      }
    } catch (e) {
      console.error(
        'Failed to fetch pending changes on-chain. Falling back to local storage.',
        e
      );
    }
  }
  const all = getMockPendingChangesFallback();
  if (!publicKey) return all;
  const budgets = getMockSharedBudgetsFallback();
  return all.filter((change) => {
    const budget = budgets.find((b) => b.id === change.budgetId);
    return budget ? isSharedBudgetMember(budget, publicKey) : true;
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────

/** Creates a shared budget with co-owners and an approval threshold. */
export async function createSharedBudget(
  publicKey: string,
  budgetData: SharedBudgetInput,
  statusCallback?: (status: string) => void
): Promise<SharedBudget> {
  const coOwners = [
    ...new Set(
      budgetData.coOwners
        .map((a) => a.trim())
        .filter((a) => a.length > 0 && a !== publicKey)
    ),
  ];
  if (coOwners.some((a) => !isValidStellarAddress(a))) {
    throw new Error('One or more co-owner addresses are not valid Stellar addresses.');
  }

  const totalMembers = coOwners.length + 1;
  const approvalThreshold = Math.min(
    Math.max(Math.floor(budgetData.approvalThreshold) || 1, 1),
    totalMembers
  );

  const newId = `shared_budget_${Date.now()}`;
  const sharedBudget: SharedBudget = {
    id: newId,
    name: budgetData.name,
    amount: budgetData.amount,
    category: budgetData.category,
    asset: budgetData.asset,
    startDate: budgetData.startDate,
    endDate: budgetData.endDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerAddress: publicKey,
    coOwners,
    approvalThreshold,
    isShared: true,
  };

  if (SHARED_BUDGET_CONTRACT_ID) {
    try {
      const result = await submitContractTx(
        publicKey,
        SHARED_BUDGET_CONTRACT_ID,
        'create_shared_budget',
        [
          publicKey,
          newId,
          budgetData.name,
          budgetData.amount,
          budgetData.category,
          budgetData.asset,
          budgetData.startDate,
          budgetData.endDate,
          coOwners,
          approvalThreshold,
        ],
        statusCallback
      );
      triggerNotification('success', 'Shared budget created successfully!');
      return { ...sharedBudget, id: result || newId };
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to create shared budget: ${errMessage}`);
      throw e;
    }
  }

  const mockBudgets = getMockSharedBudgetsFallback();
  mockBudgets.push(sharedBudget);
  setMockSharedBudgetsFallback(mockBudgets);
  notifySharedBudgetsChanged();
  return sharedBudget;
}

/**
 * Proposes a change to a shared budget. The proposer's own approval is
 * recorded automatically; the change is only applied once the number of
 * approvals reaches the budget's threshold.
 */
export async function proposeBudgetChange(
  publicKey: string,
  budgetId: string,
  changes: Partial<Pick<SharedBudget, 'name' | 'amount' | 'category' | 'asset' | 'startDate' | 'endDate'>>,
  description?: string,
  statusCallback?: (status: string) => void
): Promise<PendingBudgetChange> {
  const budgets = getMockSharedBudgetsFallback();
  const budget = budgets.find((b) => b.id === budgetId);
  if (!budget) {
    throw new Error('Shared budget not found.');
  }
  if (!isSharedBudgetMember(budget, publicKey)) {
    throw new Error('Only budget members can propose changes to a shared budget.');
  }

  if (SHARED_BUDGET_CONTRACT_ID) {
    try {
      await submitContractTx(
        publicKey,
        SHARED_BUDGET_CONTRACT_ID,
        'propose_change',
        [
          publicKey,
          budgetId,
          changes.name ?? budget.name,
          changes.amount ?? budget.amount,
          changes.category ?? budget.category,
          changes.asset ?? budget.asset,
          changes.startDate ?? budget.startDate,
          changes.endDate ?? budget.endDate,
        ],
        statusCallback
      );
      triggerNotification('info', 'Change proposed. Waiting for co-owner approvals.');
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to propose change: ${errMessage}`);
      throw e;
    }
  }

  const now = new Date().toISOString();
  const change: PendingBudgetChange = {
    id: `change_${Date.now()}`,
    budgetId,
    budgetName: budget.name,
    type: 'update',
    description: description || describeBudgetChanges(budget, changes),
    proposedBy: publicKey,
    proposedAt: now,
    changes,
    approvals: [publicKey],
    rejections: [],
    status: 'pending',
  };

  if (change.approvals.length >= budget.approvalThreshold) {
    applyPendingChange(budget, change);
    change.status = 'approved';
    change.resolvedAt = new Date().toISOString();
  }

  const pending = getMockPendingChangesFallback();
  pending.push(change);
  setMockSharedBudgetsFallback(budgets);
  setMockPendingChangesFallback(pending);
  notifySharedBudgetsChanged();
  return change;
}

/** Approves a pending change from the connected wallet (members only). */
export async function approveBudgetChange(
  publicKey: string,
  changeId: string,
  statusCallback?: (status: string) => void
): Promise<PendingBudgetChange> {
  const budgets = getMockSharedBudgetsFallback();
  const pending = getMockPendingChangesFallback();
  const change = pending.find((c) => c.id === changeId);
  if (!change) {
    throw new Error('Pending change not found.');
  }
  const budget = budgets.find((b) => b.id === change.budgetId);
  if (!budget) {
    throw new Error('The budget for this change no longer exists.');
  }
  if (change.status !== 'pending') return change;
  if (!isSharedBudgetMember(budget, publicKey)) {
    throw new Error('Only budget members can approve changes to a shared budget.');
  }

  if (SHARED_BUDGET_CONTRACT_ID) {
    try {
      await submitContractTx(
        publicKey,
        SHARED_BUDGET_CONTRACT_ID,
        'approve_change',
        [publicKey, changeId],
        statusCallback
      );
      triggerNotification('success', 'Change approved!');
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to approve change: ${errMessage}`);
      throw e;
    }
  }

  if (!change.approvals.includes(publicKey) && !change.rejections.includes(publicKey)) {
    change.approvals.push(publicKey);
  }

  if (change.approvals.length >= budget.approvalThreshold) {
    applyPendingChange(budget, change);
    change.status = 'approved';
    change.resolvedAt = new Date().toISOString();
  }

  setMockSharedBudgetsFallback(budgets);
  setMockPendingChangesFallback(pending);
  notifySharedBudgetsChanged();
  return change;
}

/** Rejects a pending change from the connected wallet (members only). */
export async function rejectBudgetChange(
  publicKey: string,
  changeId: string,
  statusCallback?: (status: string) => void
): Promise<PendingBudgetChange> {
  const budgets = getMockSharedBudgetsFallback();
  const pending = getMockPendingChangesFallback();
  const change = pending.find((c) => c.id === changeId);
  if (!change) {
    throw new Error('Pending change not found.');
  }
  const budget = budgets.find((b) => b.id === change.budgetId);
  if (!budget) {
    throw new Error('The budget for this change no longer exists.');
  }
  if (change.status !== 'pending') return change;
  if (!isSharedBudgetMember(budget, publicKey)) {
    throw new Error('Only budget members can reject changes to a shared budget.');
  }

  if (SHARED_BUDGET_CONTRACT_ID) {
    try {
      await submitContractTx(
        publicKey,
        SHARED_BUDGET_CONTRACT_ID,
        'reject_change',
        [publicKey, changeId],
        statusCallback
      );
      triggerNotification('info', 'Change rejected.');
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to reject change: ${errMessage}`);
      throw e;
    }
  }

  if (!change.approvals.includes(publicKey) && !change.rejections.includes(publicKey)) {
    change.rejections.push(publicKey);
  }

  // Once the remaining members can no longer reach the threshold, the
  // change is rejected for good.
  const totalMembers = budget.coOwners.length + 1;
  const possibleApprovals = totalMembers - change.rejections.length;
  if (possibleApprovals < budget.approvalThreshold) {
    change.status = 'rejected';
    change.resolvedAt = new Date().toISOString();
  }

  setMockSharedBudgetsFallback(budgets);
  setMockPendingChangesFallback(pending);
  notifySharedBudgetsChanged();
  return change;
}
