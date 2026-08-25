/**
 * lib/stellar/merchantTagging.ts
 *
 * Client for the sibling repo's merchant-tagging Soroban contract.
 *
 * The contract stores a mapping of:
 *   (user_pubkey, transaction_hash) → category_id
 *   (user_pubkey, merchant_address) → category_id   (auto-tag registry)
 *
 * This module provides typed wrappers for both the user-specific category
 * assignment and the shared/community merchant-to-category registry lookups.
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
  rpc as SorobanRpc,
  Transaction,
} from '@stellar/stellar-sdk';
import { getSorobanServer, getNetworkPassphrase } from '@/lib/api/stellar/client';
import { CATEGORY_IDS, getCategoryById } from '@/lib/constants/categories';

// ── Config ──────────────────────────────────────────────────────────────────

const MERCHANT_TAGGING_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MERCHANT_TAGGING_CONTRACT_ID ?? '';

// ── LocalStorage fallback (no contract deployed / offline) ──────────────────

const LOCAL_TAGS_KEY = 'stellarspend_tx_categories';
const LOCAL_MERCHANT_TAGS_KEY = 'stellarspend_merchant_categories';

interface LocalTagEntry {
  txHash: string;
  categoryId: string;
  updatedAt: string;
}

function getLocalTags(): LocalTagEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_TAGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function setLocalTags(tags: LocalTagEntry[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_TAGS_KEY, JSON.stringify(tags));
  }
}

function getLocalMerchantTags(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LOCAL_MERCHANT_TAGS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function setLocalMerchantTag(address: string, categoryId: string): void {
  if (typeof window === 'undefined') return;
  const current = getLocalMerchantTags();
  current[address] = categoryId;
  localStorage.setItem(LOCAL_MERCHANT_TAGS_KEY, JSON.stringify(current));
}

// ── ScVal helper ────────────────────────────────────────────────────────────

function toScVal(value: unknown) {
  if (typeof value === 'string' && value.startsWith('G') && value.length === 56) {
    return new Address(value).toScVal();
  }
  if (typeof value === 'number') {
    return nativeToScVal(value, { type: 'u64' });
  }
  return nativeToScVal(value);
}

// ── On-chain helpers ────────────────────────────────────────────────────────

async function callTaggingView<T>(
  publicKey: string,
  method: string,
  args: unknown[],
): Promise<T> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(MERCHANT_TAGGING_CONTRACT_ID);
  const sourceAccountResp = await server.getAccount(publicKey);
  const sourceAccount = new Account(publicKey, sourceAccountResp.sequenceNumber());
  const scArgs = args.map((arg) => toScVal(arg));

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Merchant-tagging view error (${method}): ${sim.error}`);
  }

  if (!sim.result?.retval) {
    throw new Error(`No retval from merchant-tagging view: ${method}`);
  }

  return scValToNative(sim.result.retval) as T;
}

async function submitTaggingTx(
  publicKey: string,
  method: string,
  args: unknown[],
  statusCallback?: (msg: string) => void,
): Promise<void> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(MERCHANT_TAGGING_CONTRACT_ID);
  const scArgs = args.map((arg) => toScVal(arg));

  const sourceAccountResp = await server.getAccount(publicKey);
  const sourceAccount = new Account(publicKey, sourceAccountResp.sequenceNumber());

  let tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build() as Transaction;

  statusCallback?.('Simulating...');
  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Tagging simulation failed: ${sim.error}`);
  }

  tx = SorobanRpc.assembleTransaction(tx, sim).build();

  statusCallback?.('Awaiting wallet signature...');
  if (typeof window === 'undefined' || !window.freighter) {
    throw new Error('Freighter wallet not connected or available.');
  }

  const freighter = window.freighter as unknown as {
    signTransaction: (xdr: string, opts?: string | { network?: string }) => Promise<string | { signedTxXdr?: string }>;
  };
  const networkArg = networkPassphrase.includes('Test') ? 'TESTNET' : 'PUBLIC';
  const signResult = await freighter.signTransaction(tx.toXDR(), networkArg);
  const signedTxXdr =
    typeof signResult === 'string' ? signResult : (signResult?.signedTxXdr || signResult);

  if (!signedTxXdr) {
    throw new Error('Transaction signing rejected by user.');
  }

  statusCallback?.('Submitting...');
  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr as string,
    networkPassphrase,
  ) as Transaction;
  const submitResp = await server.sendTransaction(signedTx);

  if (submitResp.status === 'ERROR') {
    throw new Error(`Submission failed: ${submitResp.errorResult || JSON.stringify(submitResp)}`);
  }

  // Wait for confirmation
  let attempts = 0;
  while (attempts < 15) {
    await new Promise((r) => setTimeout(r, 2000));
    const txStatus = await server.getTransaction(submitResp.hash);
    if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      statusCallback?.('Saved.');
      return;
    } else if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Tagging tx failed: ${JSON.stringify(txStatus.resultXdr)}`);
    }
    attempts++;
  }
  throw new Error('Tagging tx confirmation timed out.');
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface TagResult {
  categoryId: string;
  source: 'manual' | 'auto' | 'none';
  merchantAddress?: string;
}

/**
 * Get the category assigned to a specific transaction.
 * Falls back to localStorage when no contract is configured.
 */
export async function getTransactionCategory(
  publicKey: string,
  txHash: string,
): Promise<TagResult | null> {
  // Check local tags first (fast path)
  const local = getLocalTags().find((t) => t.txHash === txHash);
  if (local) {
    return { categoryId: local.categoryId, source: 'manual' };
  }

  if (!MERCHANT_TAGGING_CONTRACT_ID) {
    return null;
  }

  try {
    const raw = await callTaggingView<{ category_id: string; source: string } | null>(
      publicKey,
      'get_transaction_category',
      [publicKey, txHash],
    );
    if (raw) {
      return { categoryId: raw.category_id, source: raw.source as TagResult['source'] };
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch tx category from contract:', e);
    return null;
  }
}

/**
 * Assign a category to a transaction. Persists to contract + localStorage.
 * Also writes a merchant→category auto-tag entry if a merchant address is provided.
 */
export async function setTransactionCategory(
  publicKey: string,
  txHash: string,
  categoryId: string,
  merchantAddress?: string,
  statusCallback?: (msg: string) => void,
): Promise<void> {
  // Validate category
  if (!CATEGORY_IDS.includes(categoryId)) {
    throw new Error(`Unknown category: ${categoryId}`);
  }

  // Always update localStorage
  const local = getLocalTags().filter((t) => t.txHash !== txHash);
  local.push({ txHash, categoryId, updatedAt: new Date().toISOString() });
  setLocalTags(local);

  // Always update local merchant auto-tag
  if (merchantAddress) {
    setLocalMerchantTag(merchantAddress, categoryId);
  }

  if (!MERCHANT_TAGGING_CONTRACT_ID) {
    statusCallback?.('Saved locally (offline).');
    return;
  }

  await submitTaggingTx(
    publicKey,
    'set_transaction_category',
    [publicKey, txHash, categoryId, merchantAddress ?? ''],
    statusCallback,
  );
}

/**
 * Look up a previously-tagged merchant address for auto-suggestion.
 * Returns the category id if found, null otherwise.
 */
export async function getMerchantCategoryHint(
  publicKey: string,
  merchantAddress: string,
): Promise<string | null> {
  // Check local first
  const local = getLocalMerchantTags();
  if (local[merchantAddress]) {
    return local[merchantAddress];
  }

  if (!MERCHANT_TAGGING_CONTRACT_ID) {
    return null;
  }

  try {
    const raw = await callTaggingView<{ category_id: string } | null>(
      publicKey,
      'get_merchant_category',
      [publicKey, merchantAddress],
    );
    return raw?.category_id ?? null;
  } catch (e) {
    console.error('Failed to fetch merchant category hint:', e);
    return null;
  }
}

/**
 * Look up the merchant address associated with a transaction's outgoing operation.
 * Returns the destination address for outgoing payment transactions, null otherwise.
 */
export function getMerchantAddress(tx: {
  source_account: string;
  operations: Array<{ type: string; to?: string; from?: string }>;
}, userPublicKey: string): string | null {
  const op = tx.operations[0];
  if (!op) return null;

  // For outgoing payments, merchant = the "to" address
  if (op.type === 'payment' && op.to) {
    const isOutgoing = op.from === userPublicKey || tx.source_account === userPublicKey;
    if (isOutgoing) {
      return op.to;
    }
  }

  return null;
}

/**
 * Batch fetch categories for multiple transaction hashes.
 * Returns a map of txHash → TagResult.
 */
export async function getTransactionCategories(
  publicKey: string,
  txHashes: string[],
): Promise<Map<string, TagResult>> {
  const result = new Map<string, TagResult>();

  // Fast path: check local
  const local = getLocalTags();
  for (const hash of txHashes) {
    const entry = local.find((t) => t.txHash === hash);
    if (entry) {
      result.set(hash, { categoryId: entry.categoryId, source: 'manual' });
    }
  }

  // If contract is available, try to fill in any missing
  const missing = txHashes.filter((h) => !result.has(h));
  if (missing.length > 0 && MERCHANT_TAGGING_CONTRACT_ID) {
    try {
      const raw = await callTaggingView<
        Array<{ tx_hash: string; category_id: string; source: string }>
      >(publicKey, 'get_transaction_categories', [publicKey, missing]);

      for (const entry of raw) {
        result.set(entry.tx_hash, {
          categoryId: entry.category_id,
          source: entry.source as TagResult['source'],
        });
        // Backfill localStorage
        setLocalTags([
          ...getLocalTags().filter((t) => t.txHash !== entry.tx_hash),
          {
            txHash: entry.tx_hash,
            categoryId: entry.category_id,
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (e) {
      console.error('Failed to batch-fetch categories:', e);
    }
  }

  return result;
}