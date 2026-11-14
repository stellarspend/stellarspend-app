import { render, screen, waitFor } from "@testing-library/react";
import BalancesWidget from "../BalancesWidget";
import { fetchBalances } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  fetchBalances: jest.fn(),
}));

// BalancesWidget subscribes to the Horizon account stream on mount. Left
// unmocked, the real module reaches through the mocked client for
// getConnectedPublicKey and throws before the widget renders.
jest.mock("@/lib/stellar/accountStream", () => ({
  __esModule: true,
  startAccountStream: jest.fn(),
  subscribeAccountStream: jest.fn(() => jest.fn()),
  subscribeAccountStreamStatus: jest.fn(() => jest.fn()),
}));

const mockedFetchBalances = fetchBalances as jest.MockedFunction<
  typeof fetchBalances
>;

describe("BalancesWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("announces the loading state to assistive technology", () => {
    // Never resolves, so the widget stays in its loading state.
    mockedFetchBalances.mockReturnValue(new Promise(() => {}));

    render(<BalancesWidget />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading balances");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("drops the loading status once balances have loaded", async () => {
    mockedFetchBalances.mockResolvedValue({
      totalUsd: 1234.56,
      updatedAt: "2024-05-20T14:30:00Z",
      balances: [
        {
          asset: "XLM",
          balance: "1000.0000000",
          usdValue: 1234.56,
          change24h: 1.25,
        },
      ],
    });

    render(<BalancesWidget />);

    await waitFor(() => {
      expect(screen.getByText("1000.0000000")).toBeTruthy();
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByTestId("oracle-stale-banner")).toBeNull();
  });

  it("displays a staleness warning banner and badge when oracle rates are delayed", async () => {
    mockedFetchBalances.mockResolvedValue({
      totalUsd: 150,
      updatedAt: "2024-05-20T14:30:00Z",
      oracleStale: true,
      balances: [
        {
          asset: "XLM",
          balance: "1000.00",
          usdValue: 150,
          change24h: -1.5,
          isStale: true,
        },
      ],
    });

    render(<BalancesWidget />);

    await waitFor(() => {
      expect(screen.getByTestId("oracle-stale-banner")).toBeInTheDocument();
    });

    expect(screen.getByTestId("oracle-stale-banner")).toHaveTextContent(
      /rates may be delayed/i
    );
    expect(screen.getByTestId("asset-stale-badge")).toHaveTextContent("Delayed");
  });
});
