import {
  DEFAULT_ORACLE_STALENESS_MS,
  calculateCrossAssetBudgetSpend,
  computeChange24h,
  convertCurrency,
  fetchAllAssetPrices,
  fetchAssetPrice,
  isPriceStale,
  normalizeRawContractPrice,
} from "../priceOracle";

const mockSimulateTransaction = jest.fn();
const mockGetAccount = jest.fn();

jest.mock("@/lib/api/stellar/client", () => ({
  getSorobanServer: () => ({
    getAccount: (...args: unknown[]) => mockGetAccount(...args),
    simulateTransaction: (...args: unknown[]) =>
      mockSimulateTransaction(...args),
  }),
  getNetworkPassphrase: () => "Test SDF Network ; September 2015",
}));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    scValToNative: jest.fn((val: unknown) => val),
  };
});

describe("priceOracle", () => {
  const fixedNowMs = new Date("2026-05-20T12:00:00Z").getTime();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccount.mockResolvedValue({
      sequenceNumber: () => "100",
    });
  });

  describe("computeChange24h & normalizeRawContractPrice", () => {
    it("computes 24h percentage change accurately", () => {
      expect(computeChange24h(0.15, 0.12)).toBe(25);
      expect(computeChange24h(1.05, 1.1)).toBe(-4.55);
      expect(computeChange24h(0.15, 0)).toBe(0);
    });

    it("normalizes 7-decimal scaled integer prices from SEP-40 contracts", () => {
      expect(normalizeRawContractPrice(1_500_000)).toBeCloseTo(0.15, 6);
      expect(normalizeRawContractPrice(10_000_000)).toBeCloseTo(1.0, 6);
      expect(normalizeRawContractPrice(10_850_000)).toBeCloseTo(1.085, 6);
      expect(normalizeRawContractPrice(0.24)).toBeCloseTo(0.24, 6);
    });
  });

  describe("isPriceStale", () => {
    it("flags timestamps older than maxStalenessMs as stale", () => {
      const freshIso = new Date(fixedNowMs - 60_000).toISOString();
      const staleIso = new Date(
        fixedNowMs - DEFAULT_ORACLE_STALENESS_MS - 1_000
      ).toISOString();

      expect(
        isPriceStale(freshIso, DEFAULT_ORACLE_STALENESS_MS, fixedNowMs)
      ).toBe(false);
      expect(
        isPriceStale(staleIso, DEFAULT_ORACLE_STALENESS_MS, fixedNowMs)
      ).toBe(true);
    });
  });

  describe("fetchAssetPrice & fetchAllAssetPrices", () => {
    it("reads price and 24h change from the Soroban oracle contract", async () => {
      const recentUnixSec = Math.floor((fixedNowMs - 30_000) / 1000);
      mockSimulateTransaction.mockResolvedValueOnce({
        result: {
          retval: {
            price_usd: 2_000_000, // $0.20 scaled by 1e7
            price_24h_ago: 1_600_000, // $0.16 scaled by 1e7 -> +25%
            timestamp: recentUnixSec,
          },
        },
      });

      const quote = await fetchAssetPrice("XLM", {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        nowMs: fixedNowMs,
      });

      expect(quote.asset).toBe("XLM");
      expect(quote.priceUsd).toBeCloseTo(0.2, 4);
      expect(quote.change24h).toBe(25);
      expect(quote.isStale).toBe(false);
      expect(quote.source).toBe("contract");
    });

    it("marks quote as stale when the oracle contract timestamp exceeds threshold", async () => {
      const oldUnixSec = Math.floor(
        (fixedNowMs - DEFAULT_ORACLE_STALENESS_MS - 120_000) / 1000
      );
      mockSimulateTransaction.mockResolvedValueOnce({
        result: {
          retval: {
            price_usd: 1_500_000,
            price_24h_ago: 1_500_000,
            timestamp: oldUnixSec,
          },
        },
      });

      const quote = await fetchAssetPrice("XLM", {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        nowMs: fixedNowMs,
      });

      expect(quote.isStale).toBe(true);
    });

    it("falls back to stale-flagged quote when oracle RPC call fails", async () => {
      mockSimulateTransaction.mockRejectedValueOnce(
        new Error("RPC unavailable")
      );

      const quote = await fetchAssetPrice("EURC", {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        nowMs: fixedNowMs,
      });

      expect(quote.asset).toBe("EURC");
      expect(quote.isStale).toBe(true);
      expect(quote.source).toBe("fallback");
    });

    it("fetches quotes for XLM, USDC, and EURC", async () => {
      const quotes = await fetchAllAssetPrices({
        contractId: "",
        nowMs: fixedNowMs,
      });

      expect(quotes.XLM.priceUsd).toBeGreaterThan(0);
      expect(quotes.USDC.priceUsd).toBe(1);
      expect(quotes.EURC.priceUsd).toBeGreaterThan(1);
    });
  });

  describe("convertCurrency & calculateCrossAssetBudgetSpend", () => {
    it("converts amounts between XLM, USDC, and EURC using oracle quotes", () => {
      const customRates = { XLM: 0.2, USDC: 1.0, EURC: 1.1 };

      // 500 XLM @ $0.20 = 100 USDC
      expect(convertCurrency(500, "XLM", "USDC", customRates)).toBe(100);
      // 110 USDC @ $1.10/EURC = 100 EURC
      expect(convertCurrency(110, "USDC", "EURC", customRates)).toBe(100);
      // Same asset returns normalized numeric value
      expect(convertCurrency("250.50", "USDC", "USDC", customRates)).toBe(
        250.5
      );
    });

    it("tracks a budget in one asset against spends in another asset at spend-time rates", () => {
      // Budget is in USDC. User spent:
      // 1) 200 XLM when XLM was $0.12 (= $24.00 USDC)
      // 2) 100 XLM when XLM rose to $0.20 (= $20.00 USDC)
      // 3) 50 EURC when EURC was $1.10 (= $55.00 USDC)
      // 4) 15 USDC directly (= $15.00 USDC)
      // Total expected in USDC = 24 + 20 + 55 + 15 = 114.00 USDC
      const totalSpentUsdc = calculateCrossAssetBudgetSpend(
        "USDC",
        [
          {
            amount: 200,
            asset: "XLM",
            timestamp: "2026-05-01T10:00:00Z",
          },
          {
            amount: 100,
            asset: "XLM",
            timestamp: "2026-05-10T10:00:00Z",
          },
          {
            amount: 50,
            asset: "EURC",
            rateUsdAtSpend: 1.1,
          },
          {
            amount: 15,
            asset: "USDC",
          },
        ],
        {
          historicalRateResolver: (asset, timestamp) => {
            if (asset === "USDC") return 1.0;
            if (asset === "XLM" && timestamp === "2026-05-01T10:00:00Z") {
              return 0.12;
            }
            if (asset === "XLM" && timestamp === "2026-05-10T10:00:00Z") {
              return 0.2;
            }
            return undefined;
          },
        }
      );

      expect(totalSpentUsdc).toBe(114);
    });
  });
});
