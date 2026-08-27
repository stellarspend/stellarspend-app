/**
 * lib/stellar/spendingLimitsContract.ts
 *
 * Client for the on-chain spending-limits Soroban contract. Provides functions
 * to set, fetch, record, and delete per-asset spending limits backed by a
 * deployed Soroban contract when NEXT_PUBLIC_SPENDING_LIMITS_CONTRACT_ID is
 * configured, falling back to localStorage mock data for offline/testnet usage.
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
import { triggerNotification } from './budgetContract';

/** The time period over which a spending limit is enforced. */
export type SpendingPeriod = 'daily' | 'weekly' | 'monthly';
export type AssetCode = 'XLM' | 'USDC' | 'EURC';

export interface SpendingLimit {
  id: string;
  publicKey: string;
  asset: AssetCode;
  limitAmount: number;
  spentAmount: number;
  period: SpendingPeriod;
  periodStart: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemainingSpendingAllowance {
  asset: AssetCode;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  period: SpendingPeriod;
  hasLimit: boolean;
  limitId?: string;
}

const SPENDING_LIMITS_CONTRACT_ID = process.env.NEXT_PUBLIC_SPENDING_LIMITS_CONTRACT_ID || '';
const LOCAL_SPENDING_LIMITS_KEY = 'stellarspend_local_spending_limits';

/**
 * Returns the duration in milliseconds for a given spending period.
 * @param period - The spending period ('daily', 'weekly', or 'monthly').
 * @returns The duration in milliseconds.
 */
export function getPeriodDurationMs(period: SpendingPeriod): number {
  switch (period) {
    case 'daily':
      return 24 * 60 * 60 * 1000;
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Check and reset period spent amount if the time window has elapsed
 */
export function normalizeLimit(limit: SpendingLimit): SpendingLimit {
  const durationMs = getPeriodDurationMs(limit.period);
  const startTime = new Date(limit.periodStart || limit.createdAt).getTime();
  const now = Date.now();

  if (now - startTime >= durationMs) {
    return {
      ...limit,
      spentAmount: 0,
      periodStart: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
  }

  return limit;
}

/**
 * Loads mock spending limits from localStorage, normalizing any expired periods.
 * Returns default weekly USDC and monthly XLM limits if nothing is stored.
 * @returns An array of normalized SpendingLimit objects.
 */
export function getMockSpendingLimitsFallback(): SpendingLimit[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_SPENDING_LIMITS_KEY);
  if (stored) {
    try {
      const parsed: SpendingLimit[] = JSON.parse(stored);
      // Normalize limits to handle period expirations
      const normalized = parsed.map(normalizeLimit);
      return normalized;
    } catch (e) {
      console.error('Failed to parse mock spending limits', e);
    }
  }

  // Default initial mock limits
  const defaultLimits: SpendingLimit[] = [
    {
      id: 'limit_usdc_weekly',
      publicKey: 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO',
      asset: 'USDC',
      limitAmount: 500,
      spentAmount: 120,
      period: 'weekly',
      periodStart: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'limit_xlm_monthly',
      publicKey: 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO',
      asset: 'XLM',
      limitAmount: 2000,
      spentAmount: 350,
      period: 'monthly',
      periodStart: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SPENDING_LIMITS_KEY, JSON.stringify(defaultLimits));
  }

  return defaultLimits;
}

/**
 * Persists spending limits to localStorage.
 * @param limits - The array of SpendingLimit objects to store.
 */
export function setMockSpendingLimitsFallback(limits: SpendingLimit[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SPENDING_LIMITS_KEY, JSON.stringify(limits));
  }
}

function toScVal(value: unknown) {
  if (typeof value === 'string' && value.startsWith('G') && value.length === 56) {
    return new Address(value).toScVal();
  }
  if (typeof value === 'number') {
    return nativeToScVal(value, { type: 'u64' });
  }
  return nativeToScVal(value);
}

async function callContractView<T>(
  publicKey: string,
  contractId: string,
  method: string,
  args: unknown[]
): Promise<T> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(contractId);
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
    throw new Error(`Simulation error: ${sim.error}`);
  }

  if (!sim.result?.retval) {
    throw new Error(`No return value from view method: ${method}`);
  }

  return scValToNative(sim.result.retval) as T;
}

async function submitContractTx(
  publicKey: string,
  contractId: string,
  method: string,
  args: unknown[],
  statusCallback?: (status: string) => void
): Promise<string | null> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(contractId);
  const scArgs = args.map((arg) => toScVal(arg));

  if (statusCallback) statusCallback('Preparing transaction...');
  triggerNotification('info', `Preparing transaction for ${method}...`);

  const sourceAccountResp = await server.getAccount(publicKey);
  const sourceAccount = new Account(publicKey, sourceAccountResp.sequenceNumber());

  let tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build() as Transaction;

  if (statusCallback) statusCallback('Simulating transaction...');
  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  tx = SorobanRpc.assembleTransaction(tx, sim).build();

  if (statusCallback) statusCallback('Awaiting wallet signature...');
  if (typeof window === 'undefined' || !window.freighter) {
    throw new Error('Freighter wallet not connected or available.');
  }

  const freighter = window.freighter as unknown as {
    signTransaction: (xdr: string, opts?: string | { network?: string }) => Promise<string | { signedTxXdr?: string }>;
  };
  const networkArg = networkPassphrase.includes('Test') ? 'TESTNET' : 'PUBLIC';
  const signResult = await freighter.signTransaction(tx.toXDR(), networkArg);
  const signedTxXdr = typeof signResult === 'string' ? signResult : (signResult?.signedTxXdr || signResult);

  if (!signedTxXdr) {
    throw new Error('Transaction signing rejected by user.');
  }

  if (statusCallback) statusCallback('Submitting to network...');
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr as string, networkPassphrase) as Transaction;
  const submitResp = await server.sendTransaction(signedTx);

  if (submitResp.status === 'ERROR') {
    throw new Error(`Submission failed: ${submitResp.errorResult || JSON.stringify(submitResp)}`);
  }

  const txHash = submitResp.hash;
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    if (statusCallback) {
      statusCallback(`Confirming transaction (Attempt ${attempts + 1}/${maxAttempts})...`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const txStatus = await server.getTransaction(txHash);

    if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      if (statusCallback) statusCallback('Transaction completed successfully!');
      triggerNotification('success', `Transaction for ${method} completed successfully!`);
      if (txStatus.returnValue) {
        return scValToNative(txStatus.returnValue) as string;
      }
      return txHash;
    } else if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction processing failed: ${JSON.stringify(txStatus.resultXdr)}`);
    }
    attempts++;
  }

  throw new Error('Transaction confirmation timed out.');
}

/**
 * Fetch all spending limits for a user.
 * @param publicKey - The Stellar public key of the limit owner (optional, defaults to a demo key).
 * @returns An array of SpendingLimit objects, normalized for expired periods.
 */
export async function getLimits(publicKey?: string): Promise<SpendingLimit[]> {
  const effectiveKey = publicKey || 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO';

  if (!SPENDING_LIMITS_CONTRACT_ID) {
    const limits = getMockSpendingLimitsFallback();
    const userLimits = limits.filter((l) => l.publicKey === effectiveKey);
    if (userLimits.length === 0 && effectiveKey === 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO') {
      return limits;
    }
    return userLimits;
  }

  try {
    const raw = await callContractView<Array<{
      id: string;
      asset: string;
      limit_amount: string | number;
      spent_amount: string | number;
      period: string;
      period_start: string;
      created_at: string;
      updated_at: string;
    }>>(effectiveKey, SPENDING_LIMITS_CONTRACT_ID, 'get_limits', [effectiveKey]);

    const mapped = raw.map((item) => ({
      id: item.id,
      publicKey: effectiveKey,
      asset: item.asset as AssetCode,
      limitAmount: Number(item.limit_amount),
      spentAmount: Number(item.spent_amount || 0),
      period: (item.period as SpendingPeriod) || 'weekly',
      periodStart: item.period_start || new Date().toISOString(),
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    }));

    return mapped.map(normalizeLimit);
  } catch (e) {
    console.error('Failed to fetch spending limits on-chain. Falling back to local storage.', e);
    const limits = getMockSpendingLimitsFallback();
    setMockSpendingLimitsFallback(limits);
    return limits;
  }
}

/**
 * Calculates the remaining spending allowance for a specific asset.
 * @param publicKey - The Stellar public key of the limit owner (optional).
 * @param asset - The asset code to check (defaults to 'USDC').
 * @returns The remaining allowance details, or null if no limit is set for the asset.
 */
export async function getRemaining(
  publicKey?: string,
  asset: AssetCode = 'USDC'
): Promise<RemainingSpendingAllowance | null> {
  const limits = await getLimits(publicKey);
  const limit = limits.find((l) => l.asset === asset);

  if (!limit) {
    return null;
  }

  const remaining = Math.max(0, limit.limitAmount - limit.spentAmount);

  return {
    asset: limit.asset,
    limitAmount: limit.limitAmount,
    spentAmount: limit.spentAmount,
    remainingAmount: remaining,
    period: limit.period,
    hasLimit: true,
    limitId: limit.id,
  };
}

/**
 * Creates or updates a spending limit for a given asset.
 * @param publicKey - The Stellar public key of the limit owner.
 * @param asset - The asset code to limit (e.g. 'USDC', 'XLM').
 * @param limitAmount - The maximum spend amount for the period.
 * @param period - The time period over which the limit applies.
 * @param statusCallback - Optional callback for progress updates.
 * @returns The created or updated SpendingLimit object.
 */
export async function setLimit(
  publicKey: string,
  asset: AssetCode,
  limitAmount: number,
  period: SpendingPeriod,
  statusCallback?: (status: string) => void
): Promise<SpendingLimit> {
  const effectiveKey = publicKey || 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO';
  const newId = `limit_${asset.toLowerCase()}_${Date.now()}`;
  const now = new Date().toISOString();

  if (!SPENDING_LIMITS_CONTRACT_ID) {
    const limits = getMockSpendingLimitsFallback();
    const existingIndex = limits.findIndex((l) => l.asset === asset && l.publicKey === effectiveKey);

    const existing = existingIndex >= 0 ? limits[existingIndex] : null;
    const isSamePeriod = existing ? existing.period === period : false;
    const currentSpent = existing && isSamePeriod ? Math.min(existing.spentAmount, limitAmount) : 0;

    const newLimit: SpendingLimit = {
      id: existing ? existing.id : newId,
      publicKey: effectiveKey,
      asset,
      limitAmount,
      spentAmount: currentSpent,
      period,
      periodStart: existing && isSamePeriod ? existing.periodStart : now,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      limits[existingIndex] = newLimit;
    } else {
      limits.push(newLimit);
    }

    setMockSpendingLimitsFallback(limits);
    triggerNotification('success', `Spending limit set for ${asset} (${limitAmount} ${period})`);
    return newLimit;
  }

  try {
    const result = await submitContractTx(
      effectiveKey,
      SPENDING_LIMITS_CONTRACT_ID,
      'set_limit',
      [effectiveKey, newId, asset, limitAmount, period],
      statusCallback
    );

    const limits = getMockSpendingLimitsFallback();
    const existingIndex = limits.findIndex((l) => l.asset === asset && l.publicKey === effectiveKey);
    const existing = existingIndex >= 0 ? limits[existingIndex] : null;
    const isSamePeriod = existing ? existing.period === period : false;
    const currentSpent = existing && isSamePeriod ? Math.min(existing.spentAmount, limitAmount) : 0;

    const newLimit: SpendingLimit = {
      id: result || (existing ? existing.id : newId),
      publicKey: effectiveKey,
      asset,
      limitAmount,
      spentAmount: currentSpent,
      period,
      periodStart: existing && isSamePeriod ? existing.periodStart : now,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      limits[existingIndex] = newLimit;
    } else {
      limits.push(newLimit);
    }
    setMockSpendingLimitsFallback(limits);

    return newLimit;
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to set spending limit: ${errMessage}`);
    throw e;
  }
}

/**
 * Records a spend against the limit of a specific asset.
 * @param publicKey - The Stellar public key of the limit owner (optional).
 * @param asset - The asset code being spent (defaults to 'USDC').
 * @param amount - The amount spent (defaults to 0).
 */
export async function recordSpend(
  publicKey?: string,
  asset: AssetCode = 'USDC',
  amount: number = 0
): Promise<void> {
  const effectiveKey = publicKey || 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO';

  if (!SPENDING_LIMITS_CONTRACT_ID) {
    const limits = getMockSpendingLimitsFallback();
    const index = limits.findIndex((l) => l.asset === asset && l.publicKey === effectiveKey);
    if (index !== -1) {
      const normalized = normalizeLimit(limits[index]);
      normalized.spentAmount += amount;
      normalized.updatedAt = new Date().toISOString();
      limits[index] = normalized;
      setMockSpendingLimitsFallback(limits);
    }
    return;
  }

  try {
    await submitContractTx(
      effectiveKey,
      SPENDING_LIMITS_CONTRACT_ID,
      'record_spend',
      [effectiveKey, asset, amount]
    );

    const limits = getMockSpendingLimitsFallback();
    const index = limits.findIndex((l) => l.asset === asset && l.publicKey === effectiveKey);
    if (index !== -1) {
      limits[index].spentAmount += amount;
      limits[index].updatedAt = new Date().toISOString();
      setMockSpendingLimitsFallback(limits);
    }
  } catch (e: unknown) {
    console.error('Failed to record spend on-chain', e);
    // Fallback to local
    const limits = getMockSpendingLimitsFallback();
    const index = limits.findIndex((l) => l.asset === asset && l.publicKey === effectiveKey);
    if (index !== -1) {
      limits[index].spentAmount += amount;
      limits[index].updatedAt = new Date().toISOString();
      setMockSpendingLimitsFallback(limits);
    }
  }
}

/**
 * Deletes an existing spending limit by ID or asset code.
 * @param publicKey - The Stellar public key of the limit owner (optional).
 * @param idOrAsset - The limit ID or asset code to delete.
 * @param statusCallback - Optional callback for progress updates.
 */
export async function deleteLimit(
  publicKey?: string,
  idOrAsset: string = '',
  statusCallback?: (status: string) => void
): Promise<void> {
  const effectiveKey = publicKey || 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO';

  if (!SPENDING_LIMITS_CONTRACT_ID) {
    const limits = getMockSpendingLimitsFallback();
    const filtered = limits.filter((l) => !( (l.id === idOrAsset || l.asset === idOrAsset) && l.publicKey === effectiveKey ));
    setMockSpendingLimitsFallback(filtered);
    triggerNotification('info', 'Spending limit removed.');
    return;
  }

  try {
    await submitContractTx(
      effectiveKey,
      SPENDING_LIMITS_CONTRACT_ID,
      'delete_limit',
      [effectiveKey, idOrAsset],
      statusCallback
    );

    const limits = getMockSpendingLimitsFallback();
    const filtered = limits.filter((l) => !( (l.id === idOrAsset || l.asset === idOrAsset) && l.publicKey === effectiveKey ));
    setMockSpendingLimitsFallback(filtered);
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to delete spending limit: ${errMessage}`);
    throw e;
  }
}
