/**
 * Stellar Horizon integration.
 *
 * All network reads (balances, transactions) funnel through here so
 * client.ts can swap mock ↔ real behaviour behind a single import
 * boundary.
 *
 * Environment variables consumed:
 *   NEXT_PUBLIC_STELLAR_NETWORK – "testnet" (default) | "mainnet"
 *   NEXT_PUBLIC_HORIZON_URL     – explicit Horizon base URL (overrides
 *                                 the built-in default for the chosen
 *                                 network)
 */

import { Horizon } from "@stellar/stellar-sdk";
import { getConnectedPublicKey, type WalletBalances } from "./client";

// ── Network configuration ────────────────────────────────────────────────────

const HORIZON_URLS: Record<string, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

const NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toLowerCase() ?? "testnet";

const BASE_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ||
  HORIZON_URLS[NETWORK] ||
  HORIZON_URLS.testnet;

/** Singleton Horizon REST client. */
let _horizon: InstanceType<typeof Horizon.Server> | null = null;

function getHorizon(): InstanceType<typeof Horizon.Server> {
  if (!_horizon) _horizon = new Horizon.Server(BASE_URL);
  return _horizon;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse Stellar amounts ("1 234.567" → "1234.567"). */
function parseAmount(value: string): string {
  return Number(value.replace(/\s/g, "")).toFixed(2);
}

/** Approximate USD conversion rates. Production should use Stellar DEX / CoinGecko. */
const USD_RATES: Record<string, number> = { XLM: 0.15, USDC: 1.0, EURC: 1.08 };

const SUPPORTED_ASSETS = new Set(["USDC", "EURC"]);

// ── Types (subset of SDK types we actually read) ────────────────────────────

/** Minimal shape for Horizon account balance lines. */
interface BalanceLine {
  asset_type: string;
  balance: string;
  asset_code?: string;
}

/** Minimal shape for Horizon operation records. */
interface HorizonOpRecord {
  id: string;
  type: string;
  transaction_hash: string;
  created_at: string;
  source_account: string;
  amount?: string;
  asset_code?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  _embedded?: {
    transaction?: {
      memo?: string | Buffer | null;
      memo_type?: string;
      fee_charged?: string;
      max_fee?: string;
      ledger?: number;
      successful?: boolean;
    };
  };
}

/** App-level Transaction type (from client.ts). */
interface Transaction {
  id: string;
  hash: string;
  created_at: string;
  memo: string;
  memo_type?: string;
  successful: boolean;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  source_account: string;
  ledger: number;
  operations: {
    id: string;
    type: string;
    amount?: string;
    asset_code?: string;
    from?: string;
    to?: string;
  }[];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch real balances for the connected wallet from Horizon.
 *
 * Returns an empty snapshot when no wallet is connected or the
 * request fails — the UI stays alive either way.
 */
export async function fetchBalances(): Promise<WalletBalances> {
  const publicKey = getConnectedPublicKey();

  if (!publicKey) {
    return { balances: [], totalUsd: 0, updatedAt: new Date().toISOString() };
  }

  try {
    const account = await getHorizon().loadAccount(publicKey);
    const balances: WalletBalances["balances"] = [];

    for (const line of account.balances as BalanceLine[]) {
      if (line.asset_type === "native") {
        const xlm = parseAmount(line.balance);
        balances.push({
          asset: "XLM",
          balance: xlm,
          usdValue: +(parseFloat(xlm) * USD_RATES.XLM).toFixed(2),
          change24h: 0,
        });
      } else if (
        "asset_code" in line &&
        SUPPORTED_ASSETS.has(line.asset_code)
      ) {
        const asset = line.asset_code as "USDC" | "EURC";
        const bal = parseAmount(line.balance);
        balances.push({
          asset,
          balance: bal,
          usdValue: +(parseFloat(bal) * USD_RATES[asset]).toFixed(2),
          change24h: 0,
        });
      }
    }

    return {
      balances,
      totalUsd: balances.reduce((s, b) => s + b.usdValue, 0),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Horizon fetchBalances failed:", err);
    return { balances: [], totalUsd: 0, updatedAt: new Date().toISOString() };
  }
}

// ── Transaction mapping ──────────────────────────────────────────────────────

/**
 * Group Horizon operations by `transaction_hash`, pick the earliest
 * `created_at` per group, and build one Transaction per group.
 *
 * This mirrors the mock shape where each Transaction has a single
 * `operations[]` array (the grouped ops for that hash).
 */
function groupOpsToTransactions(records: HorizonOpRecord[]): Transaction[] {
  const grouped = new Map<string, HorizonOpRecord[]>();

  for (const op of records) {
    const list = grouped.get(op.transaction_hash) ?? [];
    list.push(op);
    grouped.set(op.transaction_hash, list);
  }

  const txns: Transaction[] = [];

  for (const [, ops] of grouped) {
    const first = ops[0];
    const txn = first._embedded?.transaction;

    // Decode memo — Horizon may return Buffer for memo_bytes type.
    const rawMemo = txn?.memo;
    const memo =
      rawMemo instanceof Buffer
        ? rawMemo.toString("utf-8")
        : typeof rawMemo === "string"
          ? rawMemo
          : "";

    const memoType =
      txn?.memo_type ??
      (rawMemo == null ? "none" : rawMemo instanceof Buffer ? "memo_bytes" : "text");

    txns.push({
      id: first.transaction_hash,
      hash: first.transaction_hash,
      created_at: first.created_at,
      memo,
      memo_type: memoType,
      successful: txn?.successful ?? true,
      fee_charged: txn?.fee_charged ?? "0",
      max_fee: txn?.max_fee ?? "0",
      operation_count: ops.length,
      source_account: first.source_account,
      ledger: txn?.ledger ?? 0,
      operations: ops.map((op) => ({
        id: String(op.id),
        type: op.type,
        amount: op.amount,
        asset_code:
          op.asset_code ?? (op.asset_type === "native" ? "XLM" : undefined),
        from: op.from,
        to: op.to,
      })),
    });
  }

  // Sort newest-first (Horizon operations are already ordered desc).
  txns.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return txns;
}

// ── Paginated response ───────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface FilterParams {
  dateFrom?: string;
  dateTo?: string;
  asset?: string;
  type?: "in" | "out" | "all";
  search?: string;
}

/**
 * Fetch a page of transactions for the connected account from Horizon.
 *
 * Uses the **operations** endpoint with `join("transactions")` so each
 * operation carries its parent transaction's memo, fee, and status.
 * Operations are grouped by `transaction_hash` on the client to match
 * the existing Transaction shape consumed by `TransactionList`.
 *
 * Client-side post-filtering handles `dateFrom/dateTo`, `asset`, `type`,
 * and free-text `search` (which inspects memo content).
 */
export async function fetchTransactions(
  filters?: FilterParams,
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<Transaction>> {
  const publicKey = getConnectedPublicKey();

  if (!publicKey) {
    return { data: [], total: 0, page, limit, hasMore: false };
  }

  try {
    // Fetch one extra group worth to detect whether more pages exist.
    // We over-fetch operations then group client-side, so request a
    // generous window to cover the group-to-page mapping.
    const opLimit = Math.max(limit * 5, 100);

    const response = await getHorizon()
      .operations()
      .forAccount(publicKey)
      .order("desc")
      .limit(opLimit)
      .join("transactions")
      .call();

    let txns = groupOpsToTransactions(
      response.records as unknown as HorizonOpRecord[],
    );

    // ── Client-side filters ────────────────────────────────────────────

    if (filters?.dateFrom) {
      const from = new Date(filters.dateFrom);
      txns = txns.filter((t) => new Date(t.created_at) >= from);
    }

    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      txns = txns.filter((t) => new Date(t.created_at) <= to);
    }

    if (filters?.asset && filters.asset !== "all") {
      txns = txns.filter((t) =>
        t.operations.some((op) => op.asset_code === filters.asset),
      );
    }

    if (filters?.type && filters.type !== "all") {
      txns = txns.filter((t) =>
        t.operations.some((op) =>
          filters.type === "in" ? op.to === publicKey : op.from === publicKey,
        ),
      );
    }

    if (filters?.search) {
      const q = filters.search.trim().toLowerCase();
      txns = txns.filter((t) => {
        const memo = t.memo?.toLowerCase() ?? "";
        const hash = t.hash?.toLowerCase() ?? "";
        const amounts = t.operations
          .map((op) => op.amount ?? "")
          .join(" ")
          .toLowerCase();
        const dateStr = new Date(t.created_at)
          .toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
          .toLowerCase();
        return (
          memo.includes(q) ||
          hash.includes(q) ||
          amounts.includes(q) ||
          dateStr.includes(q) ||
          t.created_at.toLowerCase().includes(q)
        );
      });
    }

    // Already sorted descending by Horizon.

    const total = txns.length;
    const offset = (page - 1) * limit;
    const data = txns.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { data, total, page, limit, hasMore };
  } catch (err) {
    console.error("Horizon fetchTransactions failed:", err);
    return { data: [], total: 0, page, limit, hasMore: false };
  }
}

/**
 * Fetch recent transactions for the connected account.
 *
 * Used by the dashboard `RecentTransactions` widget.
 */
export async function fetchRecentTransactions(
  limit = 10,
): Promise<Transaction[]> {
  const publicKey = getConnectedPublicKey();

  if (!publicKey) return [];

  try {
    const response = await getHorizon()
      .operations()
      .forAccount(publicKey)
      .order("desc")
      .limit(limit * 3)
      .join("transactions")
      .call();

    return groupOpsToTransactions(
      response.records as unknown as HorizonOpRecord[],
    ).slice(0, limit);
  } catch (err) {
    console.error("Horizon fetchRecentTransactions failed:", err);
    return [];
  }
}
