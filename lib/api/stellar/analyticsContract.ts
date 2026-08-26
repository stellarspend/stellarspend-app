/**
 * lib/stellar/analyticsContract.ts
 *
 * Client for the on-chain spending-analytics Soroban contract.
 *
 * This intentionally does NOT re-derive aggregates by scanning the full
 * transaction history in the frontend. Per the sibling repo's
 * bounded-computation requirement (stellarspend/<sibling>#18), all
 * aggregation (sums, bucketing, category rollups) happens on-chain / in the
 * analytics contract. This module is a thin, typed wrapper around
 * `simulateTransaction` calls against that contract.
 *
 * ASSUMPTION: There is already a `lib/stellar/client.ts` (or similar) that
 * exposes a configured Soroban RPC server + network passphrase. Adjust the
 * import below to match whatever that module is actually called in this repo.
 * If it doesn't exist yet, the shape it needs to export is sketched at the
 * bottom of this file.
 */

import {
    Contract,
    TransactionBuilder,
    Account,
    scValToNative,
    nativeToScVal,
    Address,
    xdr,
    rpc as SorobanRpc,
  } from '@stellar/stellar-sdk';
  
  // ASSUMPTION: adjust these two imports to match your existing Stellar setup.
  import { getSorobanServer, getNetworkPassphrase } from './client';
  
  // ASSUMPTION: contract IDs are centralized somewhere like this already.
  // If you have an existing `lib/stellar/contracts.ts`, add ANALYTICS_CONTRACT_ID
  // there instead and delete this fallback.
  const ANALYTICS_CONTRACT_ID =
    process.env.NEXT_PUBLIC_ANALYTICS_CONTRACT_ID ?? '';
  
  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  
  /** Assets this app supports today. Keep in sync with wherever asset config
   * currently lives (e.g. lib/stellar/assets.ts) — duplicated here only so
   * this file is self-contained; prefer importing a shared enum if one exists.
   */
  export type SupportedAsset = 'XLM' | 'USDC' | 'EURC';
  
  export const SUPPORTED_ASSETS: SupportedAsset[] = ['XLM', 'USDC', 'EURC'];
  
  export type TimeRange = 'week' | 'month' | 'quarter' | 'year';
  
  export interface TimeWindow {
    /** unix seconds, inclusive */
    startUnix: number;
    /** unix seconds, inclusive */
    endUnix: number;
  }
  
  /** Bucket granularity used for the trend chart. Chosen per time range so a
   * "year" view doesn't return 365 daily points. */
  export type Granularity = 'day' | 'week' | 'month';
  
  export interface SpendingTrendPoint {
    /** unix seconds — start of the bucket */
    bucketStart: number;
    asset: SupportedAsset;
    /** amount in the asset's smallest unit (stroops), as a string to preserve i128 precision */
    totalSpent: string;
  }
  
  export interface CategoryBreakdownEntry {
    categoryId: string;
    categoryLabel: string;
    asset: SupportedAsset;
    totalSpent: string;
    transactionCount: number;
  }
  
  export interface BudgetVsActualEntry {
    budgetId: string;
    categoryId: string;
    categoryLabel: string;
    asset: SupportedAsset;
    budgetedAmount: string;
    actualSpent: string;
  }
  
  // ---------------------------------------------------------------------------
  // Time window helpers
  // ---------------------------------------------------------------------------
  
  const DAY_SECONDS = 86_400;
  
  const RANGE_TO_SECONDS: Record<TimeRange, number> = {
    week: 7 * DAY_SECONDS,
    month: 30 * DAY_SECONDS,
    quarter: 91 * DAY_SECONDS,
    year: 365 * DAY_SECONDS,
  };
  
  const RANGE_TO_GRANULARITY: Record<TimeRange, Granularity> = {
    week: 'day',
    month: 'day',
    quarter: 'week',
    year: 'month',
  };
  
  export function getTimeWindow(range: TimeRange, now: Date = new Date()): TimeWindow {
    const endUnix = Math.floor(now.getTime() / 1000);
    const startUnix = endUnix - RANGE_TO_SECONDS[range];
    return { startUnix, endUnix };
  }
  
  export function getGranularity(range: TimeRange): Granularity {
    return RANGE_TO_GRANULARITY[range];
  }
  
  // ---------------------------------------------------------------------------
  // Low-level contract invocation
  // ---------------------------------------------------------------------------
  
  /**
   * Simulates a read-only invocation against the analytics contract and
   * decodes the return value. No signature/submission is needed since these
   * are all view-style queries — we only ever call `simulateTransaction`.
   *
   * @param sourcePublicKey - a public key with an existing ledger account to
   *   use as the simulation's source account (sequence number source only;
   *   nothing is ever signed or submitted). Typically the connected wallet's
   *   public key.
   */
  async function callAnalyticsContract<T>(
    method: string,
    args: unknown[],
    sourcePublicKey: string,
  ): Promise<T> {
    if (!ANALYTICS_CONTRACT_ID) {
      throw new Error(
        'NEXT_PUBLIC_ANALYTICS_CONTRACT_ID is not configured. Set it to the ' +
          'deployed analytics contract address.',
      );
    }
  
    const server = getSorobanServer();
    const networkPassphrase = getNetworkPassphrase();
    const contract = new Contract(ANALYTICS_CONTRACT_ID);
  
    // We need a live source account for sequence numbers. Simulation does not
    // require the account to sign anything.
    const sourceAccountResp = await server.getAccount(sourcePublicKey);
    const sourceAccount = new Account(sourcePublicKey, sourceAccountResp.sequenceNumber());
  
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
      throw new Error(`Analytics contract call "${method}" failed: ${sim.error}`);
    }
  
    if (!sim.result?.retval) {
      throw new Error(`Analytics contract call "${method}" returned no value.`);
    }
  
    return scValToNative(sim.result.retval) as T;
  }
  
  /** Converts a plain JS value into the ScVal shape the contract expects.
   * ASSUMPTION: the contract's argument encoding — adjust per the real ABI
   * once you have it (e.g. addresses may need Address.fromString(), enums may
   * be represented as symbols rather than strings, etc). */
  function toScVal(value: unknown): xdr.ScVal {
    if (typeof value === 'string' && value.startsWith('G') && value.length === 56) {
      // looks like a Stellar public key / contract address
      return new Address(value).toScVal();
    }
    if (typeof value === 'number') {
      return nativeToScVal(value, { type: 'u64' });
    }
    return nativeToScVal(value);
  }
  
  // ---------------------------------------------------------------------------
  // Public API — one function per analytics query the UI needs
  // ---------------------------------------------------------------------------
  
  export interface AnalyticsQueryParams {
    accountPublicKey: string;
    window: TimeWindow;
  }
  
  /**
   * Windowed spending-over-time series, bucketed by the contract itself.
   * Returns one entry per (bucket, asset) — assets are NEVER pre-summed
   * together, since XLM/USDC/EURC are different units of value.
   */
  export async function getSpendingTrend(
    params: AnalyticsQueryParams & { granularity: Granularity },
  ): Promise<SpendingTrendPoint[]> {
    const raw = await callAnalyticsContract<
      Array<{ bucket_start: number; asset: string; total_spent: string }>
    >(
      'get_spending_trend',
      [
        params.accountPublicKey,
        params.window.startUnix,
        params.window.endUnix,
        params.granularity,
      ],
      params.accountPublicKey,
    );
  
    return raw.map((entry) => ({
      bucketStart: entry.bucket_start,
      asset: entry.asset as SupportedAsset,
      totalSpent: entry.total_spent,
    }));
  }
  
  /** Category breakdown for the window, per asset (not blended). */
  export async function getCategoryBreakdown(
    params: AnalyticsQueryParams,
  ): Promise<CategoryBreakdownEntry[]> {
    const raw = await callAnalyticsContract<
      Array<{
        category_id: string;
        category_label: string;
        asset: string;
        total_spent: string;
        transaction_count: number;
      }>
    >(
      'get_category_breakdown',
      [params.accountPublicKey, params.window.startUnix, params.window.endUnix],
      params.accountPublicKey,
    );
  
    return raw.map((entry) => ({
      categoryId: entry.category_id,
      categoryLabel: entry.category_label,
      asset: entry.asset as SupportedAsset,
      totalSpent: entry.total_spent,
      transactionCount: entry.transaction_count,
    }));
  }
  
  /** Budget-vs-actual for every active budget overlapping the window, per asset. */
  export async function getBudgetVsActual(
    params: AnalyticsQueryParams,
  ): Promise<BudgetVsActualEntry[]> {
    const raw = await callAnalyticsContract<
      Array<{
        budget_id: string;
        category_id: string;
        category_label: string;
        asset: string;
        budgeted_amount: string;
        actual_spent: string;
      }>
    >(
      'get_budget_vs_actual',
      [params.accountPublicKey, params.window.startUnix, params.window.endUnix],
      params.accountPublicKey,
    );
  
    return raw.map((entry) => ({
      budgetId: entry.budget_id,
      categoryId: entry.category_id,
      categoryLabel: entry.category_label,
      asset: entry.asset as SupportedAsset,
      budgetedAmount: entry.budgeted_amount,
      actualSpent: entry.actual_spent,
    }));
  }
  
  // ---------------------------------------------------------------------------
  // Expected shape of ./client, if it doesn't already exist:
  //
  // export function getSorobanServer(): SorobanRpc.Server {
  //   return new SorobanRpc.Server(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!);
  // }
  //
  // export function getNetworkPassphrase(): string {
  //   return process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE!;
  // }
  // ---------------------------------------------------------------------------