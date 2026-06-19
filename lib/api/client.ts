/**
 * StellarSpend — Mock API Client
 * Simulates network latency and returns typed mock data.
 * Replace with real Stellar Horizon calls in production.
 */

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
  spentAmount?: number;
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    spentAmount: 320,
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
    spentAmount: 124,
    category: "transport",
    asset: "XLM",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    createdAt: "2024-05-19T15:30:00Z",
    updatedAt: "2024-05-19T15:30:00Z",
  },
];

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Fetch wallet balances (mock — 400 ms latency).
 */
export async function fetchBalances(): Promise<WalletBalances> {
  await delay(400);
  return { ...MOCK_BALANCES, updatedAt: new Date().toISOString() };
}

/**
 * Fetch transactions with filtering, searching, and pagination (mock — 300 ms latency).
 * @param filters - Filter parameters (date range, asset, type, search)
 * @param page - Page number (1-based)
 * @param limit - Items per page (default 10)
 */
export async function fetchTransactions(
  filters?: FilterParams,
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<Transaction>> {
  await delay(300);

  let filtered = [...MOCK_TRANSACTIONS];

  // Apply filters
  if (filters?.dateFrom) {
    const dateFrom = new Date(filters.dateFrom);
    filtered = filtered.filter((tx) => new Date(tx.created_at) >= dateFrom);
  }

  if (filters?.dateTo) {
    const dateTo = new Date(filters.dateTo);
    // Set to end of day
    dateTo.setHours(23, 59, 59, 999);
    filtered = filtered.filter((tx) => new Date(tx.created_at) <= dateTo);
  }

  if (filters?.asset && filters.asset !== "all") {
    filtered = filtered.filter(
      (tx) => tx.operations[0]?.asset_code === filters.asset,
    );
  }

  if (filters?.type && filters.type !== "all") {
    filtered = filtered.filter((tx) => {
      const recipient = tx.operations[0]?.to;
      const sender = tx.operations[0]?.from;
      const userAccount =
        "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO";

      if (filters.type === "in") {
        return recipient === userAccount;
      } else if (filters.type === "out") {
        return sender === userAccount;
      }
      return true;
    });
  }

  // Apply search
  if (filters?.search) {
    const query = filters.search.toLowerCase();
    filtered = filtered.filter(
      (tx) =>
        tx.memo.toLowerCase().includes(query) ||
        tx.hash.toLowerCase().includes(query),
    );
  }

  // Sort by date descending
  filtered.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Calculate pagination
  const total = filtered.length;
  const offset = (page - 1) * limit;
  const paginatedData = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    data: paginatedData,
    total,
    page,
    limit,
    hasMore,
  };
}

/**
 * Fetch recent transactions (mock — 300 ms latency).
 * @param limit  maximum number of records to return (default 10)
 */
export async function fetchRecentTransactions(
  limit = 10,
): Promise<Transaction[]> {
  await delay(300);
  return MOCK_TRANSACTIONS.slice(0, limit);
}

/**
 * Fetch all budgets (mock — 200 ms latency).
 */
export async function fetchBudgets(): Promise<Budget[]> {
  await delay(200);
  return [...MOCK_BUDGETS];
}

/**
 * Create a new budget (mock — 500 ms latency).
 */
export async function createBudget(
  budgetData: Omit<Budget, "id" | "createdAt" | "updatedAt">,
): Promise<Budget> {
  await delay(500);
  const newBudget: Budget = {
    ...budgetData,
    id: `budget_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  MOCK_BUDGETS.push(newBudget);
  return newBudget;
}

/**
 * Update an existing budget (mock — 400 ms latency).
 */
export async function updateBudget(
  id: string,
  budgetData: Partial<Omit<Budget, "id" | "createdAt">>,
): Promise<Budget> {
  await delay(400);
  const budgetIndex = MOCK_BUDGETS.findIndex((b) => b.id === id);
  if (budgetIndex === -1) {
    throw new Error("Budget not found");
  }

  MOCK_BUDGETS[budgetIndex] = {
    ...MOCK_BUDGETS[budgetIndex],
    ...budgetData,
    updatedAt: new Date().toISOString(),
  };

  return MOCK_BUDGETS[budgetIndex];
}

/**
 * Delete a budget (mock — 300 ms latency).
 */
export async function deleteBudget(id: string): Promise<void> {
  await delay(300);
  const budgetIndex = MOCK_BUDGETS.findIndex((b) => b.id === id);
  if (budgetIndex === -1) {
    throw new Error("Budget not found");
  }

  MOCK_BUDGETS.splice(budgetIndex, 1);
}
