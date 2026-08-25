import { render, screen, waitFor } from "@testing-library/react";
import RecentTransactions from "../RecentTransactions";
import { fetchTransactions } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  fetchTransactions: jest.fn(),
}));

const mockedFetchTransactions = fetchTransactions as jest.MockedFunction<
  typeof fetchTransactions
>;

describe("RecentTransactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the empty state with icon, message and CTA when there are no transactions", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 3,
      hasMore: false,
    });

    render(<RecentTransactions />);

    // Empty state message
    expect(
      await screen.findByText(
        "No transactions yet. Send or receive funds to get started.",
      ),
    ).toBeTruthy();

    // CTA button linking to the send/receive flow
    const cta = screen.getByRole("link", { name: /send or receive/i });
    expect(cta).toHaveAttribute("href", "/dashboard/transactions");
  });

  it("does not show empty state when transactions are present", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [
        {
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
        },
      ],
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
});