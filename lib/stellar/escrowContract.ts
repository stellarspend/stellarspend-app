/**
 * lib/stellar/escrowContract.ts
 *
 * Wraps the sibling repo's escrow Soroban contract for bill-splitting /
 * payment-request flows. Follows the same shape as budgetContract.ts /
 * savingsGoalContract.ts: real contract calls when NEXT_PUBLIC_ESCROW_CONTRACT_ID
 * is configured, otherwise a localStorage-backed mock so the UI is usable
 * against testnet or fully offline.
 *
 * Real-time collection progress (Issue #4) is approximated here with a
 * short-interval poll of fetchSplit() rather than a server-push stream,
 * since no streaming transport exists in this repo yet. subscribeToSplit()
 * is the seam to swap in a real subscription later without touching
 * callers.
 */

import type { CreateSplitInput, SplitBill, SplitShare } from '@/lib/types/splits';
import { callContractView, submitContractTx, triggerNotification } from './budgetContract';

const ESCROW_CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? '';
const LOCAL_SPLITS_KEY = 'stellarspend_local_splits';
const POLL_INTERVAL_MS = 4000;

function getMockSplits(): SplitBill[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_SPLITS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SplitBill[];
  } catch (e) {
    console.error('Failed to parse mock splits', e);
    return [];
  }
}

function setMockSplits(splits: SplitBill[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SPLITS_KEY, JSON.stringify(splits));
  // Notify other tabs/components watching this split in real time.
  window.dispatchEvent(new CustomEvent('stellarspend_split_update'));
}

function buildShares(input: CreateSplitInput): SplitShare[] {
  if (input.method === 'even') {
    const evenAmount = Math.round((input.totalAmount / input.participants.length) * 100) / 100;
    return input.participants.map((p) => ({
      participant: p.address,
      amount: evenAmount,
      status: 'pending',
    }));
  }
  return input.participants.map((p) => ({
    participant: p.address,
    amount: p.amount,
    status: 'pending',
  }));
}

function isFullyCollected(split: SplitBill): boolean {
  return split.shares.every((s) => s.status === 'paid');
}

/** Creates a split bill and its escrow entries. Requester pays nothing up front. */
export async function createSplit(
  creatorPublicKey: string,
  input: CreateSplitInput,
  statusCallback?: (status: string) => void,
): Promise<SplitBill> {
  const newId = `split_${Date.now()}`;
  const shares = buildShares(input);

  if (!ESCROW_CONTRACT_ID) {
    const split: SplitBill = {
      id: newId,
      creator: creatorPublicKey,
      description: input.description,
      totalAmount: input.totalAmount,
      asset: input.asset,
      method: input.method,
      shares,
      status: 'collecting',
      createdAt: new Date().toISOString(),
    };
    const splits = getMockSplits();
    splits.push(split);
    setMockSplits(splits);
    return split;
  }

  try {
    const escrowAccount = await submitContractTx(
      creatorPublicKey,
      ESCROW_CONTRACT_ID,
      'create_split',
      [
        creatorPublicKey,
        newId,
        input.description,
        input.totalAmount,
        input.asset,
        shares.map((s) => s.participant),
        shares.map((s) => s.amount),
      ],
      statusCallback,
    );

    const split: SplitBill = {
      id: newId,
      creator: creatorPublicKey,
      description: input.description,
      totalAmount: input.totalAmount,
      asset: input.asset,
      method: input.method,
      shares,
      status: 'collecting',
      escrowAccount: escrowAccount ?? undefined,
      createdAt: new Date().toISOString(),
    };

    // Mirror into local cache so fetchSplit/subscribeToSplit have a fast
    // path even before the next on-chain read.
    const splits = getMockSplits();
    splits.push(split);
    setMockSplits(splits);
    return split;
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to create split: ${errMessage}`);
    throw e;
  }
}

/** Pays the calling participant's share into escrow, targeting the escrow contract. */
export async function paySplitShare(
  participantPublicKey: string,
  splitId: string,
  statusCallback?: (status: string) => void,
): Promise<SplitBill> {
  const splits = getMockSplits();
  const index = splits.findIndex((s) => s.id === splitId);
  if (index === -1) throw new Error('Split not found');
  const split = splits[index];

  const share = split.shares.find((s) => s.participant === participantPublicKey);
  if (!share) throw new Error('You are not a participant in this split');
  if (share.status === 'paid') throw new Error('Share already paid');
  if (share.status === 'disputed') throw new Error('Share is under dispute');

  let txHash: string | undefined;

  if (ESCROW_CONTRACT_ID) {
    try {
      const result = await submitContractTx(
        participantPublicKey,
        ESCROW_CONTRACT_ID,
        'pay_share',
        [participantPublicKey, splitId, share.amount],
        statusCallback,
      );
      txHash = result ?? undefined;
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to pay share: ${errMessage}`);
      throw e;
    }
  } else if (statusCallback) {
    statusCallback('Submitting to network...');
  }

  share.status = 'paid';
  share.paidAt = new Date().toISOString();
  share.transactionHash = txHash;

  if (isFullyCollected(split)) {
    await releaseSplitFunds(split, statusCallback);
  }

  splits[index] = split;
  setMockSplits(splits);
  return split;
}

/** Releases collected funds to the requester once every share has been paid. */
async function releaseSplitFunds(
  split: SplitBill,
  statusCallback?: (status: string) => void,
): Promise<void> {
  if (statusCallback) statusCallback('All shares collected — releasing funds...');

  if (ESCROW_CONTRACT_ID) {
    try {
      const releaseTxHash = await submitContractTx(
        split.creator,
        ESCROW_CONTRACT_ID,
        'release_funds',
        [split.creator, split.id],
        statusCallback,
      );
      split.releaseTransactionHash = releaseTxHash ?? undefined;
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to release escrowed funds: ${errMessage}`);
      throw e;
    }
  }

  split.status = 'released';
  split.releasedAt = new Date().toISOString();
  triggerNotification('success', `Split "${split.description}" fully collected — funds released to requester.`);
}

/** Routes a participant's disputed share into the escrow contract's dispute/arbitration path. */
export async function disputeSplitShare(
  participantPublicKey: string,
  splitId: string,
  reason: string,
  statusCallback?: (status: string) => void,
): Promise<SplitBill> {
  const splits = getMockSplits();
  const index = splits.findIndex((s) => s.id === splitId);
  if (index === -1) throw new Error('Split not found');
  const split = splits[index];

  const share = split.shares.find((s) => s.participant === participantPublicKey);
  if (!share) throw new Error('You are not a participant in this split');
  if (share.status === 'paid') throw new Error('Cannot dispute a share that has already been paid');

  if (ESCROW_CONTRACT_ID) {
    try {
      await submitContractTx(
        participantPublicKey,
        ESCROW_CONTRACT_ID,
        'dispute_share',
        [participantPublicKey, splitId, reason],
        statusCallback,
      );
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      triggerNotification('error', `Failed to file dispute: ${errMessage}`);
      throw e;
    }
  }

  share.status = 'disputed';
  share.disputeReason = reason;
  split.status = 'disputed';

  splits[index] = split;
  setMockSplits(splits);
  triggerNotification('info', `Dispute filed for your share of "${split.description}". Routed to arbitration.`);
  return split;
}

export async function fetchSplit(splitId: string, requesterPublicKey: string): Promise<SplitBill | null> {
  if (!ESCROW_CONTRACT_ID) {
    return getMockSplits().find((s) => s.id === splitId) ?? null;
  }
  try {
    const raw = await callContractView<SplitBill>(requesterPublicKey, ESCROW_CONTRACT_ID, 'get_split', [splitId]);
    return raw;
  } catch (e) {
    console.error('Failed to fetch split on-chain. Falling back to local cache.', e);
    return getMockSplits().find((s) => s.id === splitId) ?? null;
  }
}

/** Splits the given user created, or is a participant in, most recent first. */
export async function fetchSplitsForUser(publicKey: string): Promise<SplitBill[]> {
  if (!ESCROW_CONTRACT_ID) {
    return getMockSplits()
      .filter((s) => s.creator === publicKey || s.shares.some((sh) => sh.participant === publicKey))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  try {
    const raw = await callContractView<SplitBill[]>(publicKey, ESCROW_CONTRACT_ID, 'get_splits_for_account', [publicKey]);
    return raw;
  } catch (e) {
    console.error('Failed to fetch splits on-chain. Falling back to local cache.', e);
    return getMockSplits().filter(
      (s) => s.creator === publicKey || s.shares.some((sh) => sh.participant === publicKey),
    );
  }
}

/**
 * Subscribes to real-time collection-progress updates for one split.
 * Polls on an interval and also reacts instantly to same-tab mock writes
 * via the `stellarspend_split_update` event. Returns an unsubscribe fn.
 */
export function subscribeToSplit(
  splitId: string,
  requesterPublicKey: string,
  onUpdate: (split: SplitBill | null) => void,
): () => void {
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    const split = await fetchSplit(splitId, requesterPublicKey);
    if (!cancelled) onUpdate(split);
  };

  tick();
  const intervalId = setInterval(tick, POLL_INTERVAL_MS);

  const onLocalUpdate = () => tick();
  if (typeof window !== 'undefined') {
    window.addEventListener('stellarspend_split_update', onLocalUpdate);
  }

  return () => {
    cancelled = true;
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('stellarspend_split_update', onLocalUpdate);
    }
  };
}

export function collectionProgress(split: SplitBill): { paid: number; total: number } {
  return {
    paid: split.shares.filter((s) => s.status === 'paid').length,
    total: split.shares.length,
  };
}
