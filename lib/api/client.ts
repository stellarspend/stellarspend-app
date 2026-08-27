/**
 * StellarSpend — API Client
 * Read path (balances, transactions) calls real Stellar Horizon.
 * Write/send path and budgets are out of scope (Issue #97).
 */

import {
  fetchBudgets as fetchContractBudgets,
  createBudget as createContractBudget,
  updateBudget as updateContractBudget,
  deleteBudget as deleteContractBudget,
  getMockBudgetsFallback,
  setMockBudgetsFallback,
} from '@/lib/stellar/budgetContract';
import {
  fetchBalances as horizonFetchBalances,
  fetchTransactions as horizonFetchTransactions,
  fetchRecentTransactions as horizonFetchRecentTransactions,
} from './horizon';

interface LocalWallet {
  id: string;
  publicKey?: string;
}

export function getConnectedPublicKey(): string | null {
  if (typeof window === 'undefined') return null;
  const selectedWalletId = localStorage.getItem('stellarspend_selected_wallet');
  const walletsStr = localStorage.getItem('stellarspend_wallets');
  if (selectedWalletId && walletsStr) {
    try {
      const wallets = JSON.parse(walletsStr);
      const selected = wallets.find((w: LocalWallet) => w.id === selectedWalletId);
      if (selected && selected.publicKey) {
        return selected.publicKey;
      }
    } catch (e) {
      console.error('Failed to parse wallets from localStorage', e);
    }
  }
  return null;
}


export interface AssetBalance {
  asset: "XLM" | "USDC" | "EURC";
  balance: string;
  usdValue: number;
  change24h: number; // percent
}

export interface WalletBalances {
  balances: AssetBalance[];
  totalUsd: number;
  updatedAt: string;
}

export interface Transaction {
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

export interface Budget {
  id: string;
  name: string;
  amount: number;
  category: string;
  asset: "XLM" | "USDC" | "EURC";
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}
export interface FilterParams {
  dateFrom?: string;
  dateTo?: string;
  asset?: string;
  type?: "in" | "out" | "all";
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Re-export real Horizon implementations.
 *
 * Each function reads from Stellar Horizon via `getConnectedPublicKey()`
 * and returns data shaped to the exact types defined below so no calling
 * component needs to change its call signature.
 */
export const fetchBalances: () => Promise<WalletBalances> = horizonFetchBalances;

export const fetchTransactions: (
  filters?: FilterParams,
  page?: number,
  limit?: number,
) => Promise<PaginatedResponse<Transaction>> = horizonFetchTransactions;

export const fetchRecentTransactions: (
  limit?: number,
) => Promise<Transaction[]> = horizonFetchRecentTransactions;

// ─── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_BALANCES: WalletBalances = {
  balances: [
    { asset: "XLM", balance: "4 210.50", usdValue: 631.58, change24h: +2.4 },
    { asset: "USDC", balance: "1 085.20", usdValue: 1085.2, change24h: +0.01 },
    { asset: "EURC", balance: "320.00", usdValue: 347.2, change24h: -0.31 },
  ],
  totalUsd: 2063.98,
  updatedAt: new Date().toISOString(),
};

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_1",
    hash: "8f7d6e5c4b3a21098f7d6e5c4b3a21098f7d6e5c4b3a21098f7d6e5c4b3a2109",
    created_at: "2024-05-20T14:30:00Z",
    memo: "Coffee payment",
    memo_type: "text",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234567,
    operations: [
      {
        id: "op_1",
        type: "payment",
        amount: "15.50",
        asset_code: "USDC",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GBCS422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
  {
    id: "tx_2",
    hash: "1a2b3c4d5e6f7g8h9i0j1a2b3c4d5e6f7g8h9i0j1a2b3c4d5e6f7g8h9i0j1a2b",
    created_at: "2024-05-19T09:15:00Z",
    memo: "Monthly savings",
    memo_type: "text",
    successful: true,
    fee_charged: "200",
    max_fee: "2000",
    operation_count: 2,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234568,
    operations: [
      {
        id: "op_2",
        type: "payment",
        amount: "100.00",
        asset_code: "XLM",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GASV422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
  {
    id: "tx_3",
    hash: "5e6f7g8h9i0j1a2b3c4d5e6f7g8h9i0j1a2b3c4d5e6f7g8h9i0j1a2b3c4d5e6",
    created_at: "2024-05-18T18:45:00Z",
    memo: "Rent Payment",
    memo_type: "text",
    successful: false,
    fee_charged: "150",
    max_fee: "1500",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234569,
    operations: [
      {
        id: "op_4",
        type: "payment",
        amount: "850.00",
        asset_code: "EURC",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GRNT422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
  {
    id: "tx_4",
    hash: "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def",
    created_at: "2024-05-17T10:20:00Z",
    memo: "Freelance payment received",
    memo_type: "text",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account:
      "GCLI422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    ledger: 51234570,
    operations: [
      {
        id: "op_5",
        type: "payment",
        amount: "250.00",
        asset_code: "USDC",
        from: "GCLI422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
        to: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
      },
    ],
  },
  {
    id: "tx_5",
    hash: "xyz789uvw456rst123opq890lmn567ijk234fgh901cde678abc345def012ghi",
    created_at: "2024-05-16T16:45:00Z",
    memo: "Gas refund",
    memo_type: "text",
    successful: true,
    fee_charged: "50",
    max_fee: "500",
    operation_count: 1,
    source_account:
      "GZER422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    ledger: 51234571,
    operations: [
      {
        id: "op_6",
        type: "payment",
        amount: "5.00",
        asset_code: "XLM",
        from: "GZER422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
        to: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
      },
    ],
  },
  {
    id: "tx_6",
    hash: "jkl456mno789pqr012stu345vwx678yz901abc234def567ghi890ijk123lmn456",
    created_at: "2024-05-15T11:30:00Z",
    memo: "Dividend distribution",
    memo_type: "text",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account:
      "GXXX422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    ledger: 51234572,
    operations: [
      {
        id: "op_7",
        type: "payment",
        amount: "75.50",
        asset_code: "USDC",
        from: "GXXX422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
        to: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
      },
    ],
  },
  {
    id: "tx_7",
    hash: "mmm789nnn012ooo345ppp678qqq901rrr234sss567ttt890uuu123vvv456www",
    created_at: "2024-05-14T13:00:00Z",
    memo: "Bill payment",
    memo_type: "text",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234573,
    operations: [
      {
        id: "op_8",
        type: "payment",
        amount: "150.00",
        asset_code: "EURC",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GYYY422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
  {
    id: "tx_8",
    hash: "xxx012yyy345zzz678aaa901bbb234ccc567ddd890eee123fff456ggg789hhh",
    created_at: "2024-05-13T08:15:00Z",
    memo: "Exchange trade",
    memo_type: "text",
    successful: true,
    fee_charged: "150",
    max_fee: "1500",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234574,
    operations: [
      {
        id: "op_9",
        type: "payment",
        amount: "200.00",
        asset_code: "XLM",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GZZZ422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
  {
    id: "tx_9",
    hash: "iii456jjj789kkk012lll345mmm678nnn901ooo234ppp567qqq890rrr123sss",
    created_at: "2024-05-12T15:40:00Z",
    memo: "Account setup",
    memo_type: "text",
    successful: true,
    fee_charged: "200",
    max_fee: "2000",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234575,
    operations: [
      {
        id: "op_10",
        type: "change_trust",
        asset_code: "USDC",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
      },
    ],
  },
  {
    id: "tx_10",
    hash: "ttt789uuu012vvv345www678xxx901yyy234zzz567aaa890bbb123ccc456ddd",
    created_at: "2024-05-11T12:25:00Z",
    memo: "Refund rejected",
    memo_type: "text",
    successful: false,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234576,
    operations: [
      {
        id: "op_11",
        type: "payment",
        amount: "50.00",
        asset_code: "USDC",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GAAA422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
  {
    id: "tx_11",
    hash: "ddd890eee123fff456ggg789hhh012iii345jjj678kkk901lll234mmm567nnn",
    created_at: "2024-05-10T09:50:00Z",
    memo: "Investment deposit",
    memo_type: "text",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account:
      "GBBB422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
    ledger: 51234577,
    operations: [
      {
        id: "op_12",
        type: "payment",
        amount: "500.00",
        asset_code: "XLM",
        from: "GBBB422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
        to: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
      },
    ],
  },
  {
    id: "tx_12",
    hash: "ooo234ppp567qqq890rrr123sss456ttt789uuu012vvv345www678xxx901yyy",
    created_at: "2024-05-09T14:10:00Z",
    memo: "Purchase",
    memo_type: "text",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
    ledger: 51234578,
    operations: [
      {
        id: "op_13",
        type: "payment",
        amount: "45.25",
        asset_code: "EURC",
        from: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO",
        to: "GCCC422X44QW6UXO6R6AOTHOV4CGDQD6A4P422X44QW6UXO6R6AOTHOV4C",
      },
    ],
  },
];

export const MOCK_BUDGETS: Budget[] = [
  {
    id: "budget_1",
    name: "Monthly Groceries",
    amount: 500,
    category: "food",
    asset: "USDC",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    createdAt: "2024-05-20T10:00:00Z",
    updatedAt: "2024-05-20T10:00:00Z",
  },
  {
    id: "budget_2",
    name: "Transportation",
    amount: 150,
    category: "transport",
    asset: "XLM",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    createdAt: "2024-05-19T15:30:00Z",
    updatedAt: "2024-05-19T15:30:00Z",
  },
];

// ─── API Functions ──────────────────────────────────────────────────────────

// ── Read-path functions (delegated to real Horizon) ───────────────────────
// See re-exports above (fetchBalances, fetchTransactions, fetchRecentTransactions).

// ── Budget functions (still delegate to on-chain contract / local fallback) ──

/**
 * Fetch all budgets (mock — 200 ms latency).
 */
export async function fetchBudgets(): Promise<Budget[]> {
  const publicKey = getConnectedPublicKey();
  if (publicKey) {
    return fetchContractBudgets(publicKey);
  }
  return getMockBudgetsFallback();
}

/**
 * Create a new budget (mock — 500 ms latency).
 */
export async function createBudget(
  budgetData: Omit<Budget, "id" | "createdAt" | "updatedAt">,
): Promise<Budget> {
  const publicKey = getConnectedPublicKey();
  if (publicKey) {
    return createContractBudget(publicKey, budgetData);
  }
  const mockBudgets = getMockBudgetsFallback();
  const newBudget: Budget = {
    ...budgetData,
    id: `budget_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockBudgets.push(newBudget);
  setMockBudgetsFallback(mockBudgets);
  return newBudget;
}

/**
 * Update an existing budget (mock — 400 ms latency).
 */
export async function updateBudget(
  id: string,
  budgetData: Partial<Omit<Budget, "id" | "createdAt">>,
): Promise<Budget> {
  const publicKey = getConnectedPublicKey();
  if (publicKey) {
    return updateContractBudget(publicKey, id, budgetData);
  }
  const mockBudgets = getMockBudgetsFallback();
  const budgetIndex = mockBudgets.findIndex((b) => b.id === id);
  if (budgetIndex === -1) {
    throw new Error("Budget not found");
  }
  mockBudgets[budgetIndex] = {
    ...mockBudgets[budgetIndex],
    ...budgetData,
    updatedAt: new Date().toISOString(),
  };
  setMockBudgetsFallback(mockBudgets);
  return mockBudgets[budgetIndex];
}

/**
 * Delete a budget (mock — 300 ms latency).
 */
export async function deleteBudget(id: string): Promise<void> {
  const publicKey = getConnectedPublicKey();
  if (publicKey) {
    return deleteContractBudget(publicKey, id);
  }
  const mockBudgets = getMockBudgetsFallback();
  const filtered = mockBudgets.filter((b) => b.id !== id);
  setMockBudgetsFallback(filtered);
}

// ── Send path (still mock — out of scope for issue #97) ───────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submits a send payment transaction, optionally attaching a ZK proof.
 */
export async function sendPayment(
  recipient: string,
  amount: number,
  asset: 'XLM' | 'USDC' | 'EURC',
  proof?: string | Uint8Array
): Promise<Transaction> {
  await delay(500);

  // Parse current balance
  const balIndex = MOCK_BALANCES.balances.findIndex((b) => b.asset === asset);
  if (balIndex !== -1) {
    const currentVal = parseFloat(MOCK_BALANCES.balances[balIndex].balance.replace(/\s/g, ''));
    if (currentVal < amount) {
      throw new Error(`Insufficient funds: You have ${currentVal} ${asset} but tried to send ${amount}.`);
    }
    // Update balance
    const nextVal = currentVal - amount;
    MOCK_BALANCES.balances[balIndex].balance = nextVal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).replace(/,/g, ' '); // Match space format
    
    // Update usdValue
    const conversionRates = { XLM: 0.15, USDC: 1.0, EURC: 1.08 };
    MOCK_BALANCES.balances[balIndex].usdValue = nextVal * conversionRates[asset];
    MOCK_BALANCES.totalUsd = MOCK_BALANCES.balances.reduce((acc, curr) => acc + curr.usdValue, 0);
  }

  // Create new transaction object
  const newTx: Transaction = {
    id: `tx_${Date.now()}`,
    hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    created_at: new Date().toISOString(),
    memo: proof ? 'ZK Spending Limit' : 'Direct Payment',
    successful: true,
    fee_charged: '100',
    max_fee: '1000',
    operation_count: 1,
    source_account: getConnectedPublicKey() || 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO',
    ledger: 51234580,
    operations: [
      {
        id: `op_${Date.now()}`,
        type: 'payment',
        amount: amount.toFixed(2),
        asset_code: asset,
        from: getConnectedPublicKey() || 'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO',
        to: recipient,
      },
    ],
  };

  MOCK_TRANSACTIONS.unshift(newTx);
  return newTx;
}

