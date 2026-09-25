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

    const { container } = render(<RecentTransactions />);

    // Empty state message
    expect(
      await screen.findByText(
        "No transactions yet. Send or receive funds to get started.",
      ),
    ).toBeTruthy();

    // Inbox icon is rendered alongside the message
    expect(container.querySelector("svg.lucide-inbox")).toBeTruthy();

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

  it("applies error styling to a failed transaction row", async () => {
    mockedFetchTransactions.mockResolvedValue({
      data: [
        {
          id: "tx_failed",
          hash: "hash_failed",
          created_at: "2024-05-21T09:15:00Z",
          memo: "Failed payment",
          successful: false,
          fee_charged: "100",
          max_fee: "1000",
          operation_count: 1,
          source_account: "account",
          ledger: 2,
          operations: [
            {
              id: "op_failed",
              type: "payment",
              amount: "42.00",
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

    const { container } = render(<RecentTransactions />);

    await waitFor(() => {
      expect(screen.getByText("Failed payment")).toBeTruthy();
    });

    // Asset code is rendered in the error colour rather than the default gold
    const assetCode = screen.getByText("USDC");
    expect(assetCode.className).toContain("text-red-400");
    expect(assetCode.className).not.toContain("text-[#e8b84b]");

    // Icon container carries the red background/border treatment
    const iconWrapper = container.querySelector(".bg-red-500\\/10");
    expect(iconWrapper).toBeTruthy();
    expect(iconWrapper?.className).toContain("border-red-500/20");
    expect(iconWrapper?.className).toContain("text-red-400");

    // Failed rows use the alert icon, not a directional arrow
    expect(container.querySelector("svg.lucide-circle-alert")).toBeTruthy();

    // Trailing status dot is red rather than green/pending-gold
    const statusDot = container.querySelector(".bg-red-400");
    expect(statusDot).toBeTruthy();
    expect(container.querySelector(".bg-\\[\\#4ade80\\]")).toBeNull();
  });
});