import { render, screen, waitFor, act } from "@testing-library/react";
import RecentTransactions from "../RecentTransactions";
import { fetchTransactions } from "@/lib/api/client";
import type { Transaction } from "@/lib/api/client";
import {
  startAccountStream as realStart,
  subscribeAccountStream as realSubscribe,
  subscribeAccountStreamStatus as realSubscribeStatus,
} from "@/lib/stellar/accountStream";

jest.mock("@/lib/api/client", () => ({
  fetchTransactions: jest.fn(),
}));

jest.mock("@/lib/stellar/accountStream", () => ({
  __esModule: true,
  startAccountStream: jest.fn(),
  subscribeAccountStream: jest.fn(() => jest.fn()),
  subscribeAccountStreamStatus: jest.fn(() => jest.fn()),
}));

const mockedFetchTransactions = fetchTransactions as jest.MockedFunction<
  typeof fetchTransactions
>;

const mockedStart = realStart as jest.MockedFunction<typeof realStart>;
const mockedSubscribe = realSubscribe as jest.MockedFunction<typeof realSubscribe>;
const mockedSubscribeStatus = realSubscribeStatus as jest.MockedFunction<
  typeof realSubscribeStatus
>;

type AnyListener = (payload: unknown) => void;

let streamEventListener: AnyListener | undefined;
let streamStatusListener: AnyListener | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  streamEventListener = undefined;
  streamStatusListener = undefined;

  mockedSubscribe.mockImplementation((listener) => {
    streamEventListener = listener as AnyListener;
    return jest.fn();
  });
  mockedSubscribeStatus.mockImplementation((listener) => {
    streamStatusListener = listener as AnyListener;
    return jest.fn();
  });
});

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_1",
    hash: "hash1",
    created_at: "2024-05-20T14:30:00Z",
    memo: "Coffee payment",
    successful: true,
    fee_charged: "100",
    max_fee: "1000",
    operation_count: 1,
    source_account: "account",
    ledger: 1,
    operations: [
      {
        id: "op_1",
        type: "payment",
        amount: "15.50",
        asset_code: "USDC",
        from: "GDQD-profile",
        to: "other",
      },
    ],
    ...overrides,
  };
}

describe("RecentTransactions", () => {
  it("shows the empty state with icon, message and CTA when there are no transactions", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 3,
      hasMore: false,
    });

    render(<RecentTransactions />);

    expect(
      await screen.findByText(
        "No transactions yet. Send or receive funds to get started.",
      ),
    ).toBeTruthy();

    const cta = screen.getByRole("link", { name: /send or receive/i });
    expect(cta).toHaveAttribute("href", "/dashboard/transactions");
  });

  it("does not show empty state when transactions are present", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [tx()],
      total: 1,
      page: 1,
      limit: 3,
      hasMore: false,
    });

    render(<RecentTransactions />);

    await waitFor(() => {
      expect(screen.getByText("Coffee payment")).toBeTruthy();
    });

    expect(
      screen.queryByText(
        "No transactions yet. Send or receive funds to get started.",
      ),
    ).toBeNull();
  });

  it("starts the account stream on mount", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 3,
      hasMore: false,
    });

    render(<RecentTransactions />);

    await waitFor(() => {
      expect(mockedStart).toHaveBeenCalled();
    });
    expect(mockedSubscribe).toHaveBeenCalled();
    expect(mockedSubscribeStatus).toHaveBeenCalled();
  });

  it("refetches transactions and shows the new-activity badge on a live payment", async () => {
    mockedFetchTransactions
      .mockResolvedValueOnce({
        data: [tx()],
        total: 1,
        page: 1,
        limit: 3,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        data: [
          tx({
            id: "tx_2",
            hash: "hash2",
            memo: "Incoming payment",
            operations: [
              {
                id: "op_2",
                type: "payment",
                amount: "25.00",
                asset_code: "USDC",
                from: "other",
                to: "account",
              },
            ],
          }),
          tx(),
        ],
        total: 2,
        page: 1,
        limit: 3,
        hasMore: false,
      });

    render(<RecentTransactions />);

    await screen.findByText("Coffee payment");

    act(() => {
      streamEventListener?.({
        kind: "operation",
        account: "account",
        operation: {
          id: "op_2",
          type: "payment",
          transaction_hash: "hash2",
          paging_token: "t2",
          created_at: "2024-05-20T15:00:00Z",
          source_account: "account",
        },
        receivedAt: Date.now(),
      });
    });

    expect(await screen.findByText("Incoming payment")).toBeTruthy();
    expect(screen.getByText("New activity")).toBeTruthy();
    expect(mockedFetchTransactions).toHaveBeenCalledTimes(2);
  });

  it("refetches when the stream connects to a different wallet (wallet switch)", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [tx()],
      total: 1,
      page: 1,
      limit: 3,
      hasMore: false,
    });

    render(<RecentTransactions />);

    await waitFor(() => {
      expect(mockedFetchTransactions).toHaveBeenCalledTimes(1);
    });

    act(() => {
      streamStatusListener?.({
        status: "connected",
        account: "GBswitched-account",
      });
    });

    await waitFor(() => {
      expect(mockedFetchTransactions).toHaveBeenCalledTimes(2);
    });
  });
});