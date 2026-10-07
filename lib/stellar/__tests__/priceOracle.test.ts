import { describe, expect, it } from '@jest/globals';
import {
  isRateStale,
  convertAsset,
  convertToUsd,
  fetchOracleRates,
  BASELINE_RATES,
  DEFAULT_STALENESS_THRESHOLD_MS,
} from '../priceOracle';

describe('priceOracle', () => {
  describe('isRateStale', () => {
    it('returns false when timestamp is recent', () => {
      const now = Date.now();
      expect(isRateStale(now - 1000)).toBe(false);
      expect(isRateStale(now - DEFAULT_STALENESS_THRESHOLD_MS + 5000)).toBe(false);
    });

    it('returns true when timestamp exceeds the default threshold', () => {
      const now = Date.now();
      expect(isRateStale(now - DEFAULT_STALENESS_THRESHOLD_MS - 1000)).toBe(true);
    });

    it('returns true for 0 or negative timestamp', () => {
      expect(isRateStale(0)).toBe(true);
      expect(isRateStale(-100)).toBe(true);
    });

    it('respects custom threshold', () => {
      const now = Date.now();
      const customThreshold = 5000;
      expect(isRateStale(now - 4000, customThreshold)).toBe(false);
      expect(isRateStale(now - 6000, customThreshold)).toBe(true);
    });
  });

  describe('convertAsset', () => {
    it('returns 0 when amount is 0', () => {
      expect(convertAsset(0, 'XLM', 'USDC')).toBe(0);
    });

    it('returns same amount when fromAsset matches toAsset', () => {
      expect(convertAsset(50, 'XLM', 'XLM')).toBe(50);
      expect(convertAsset(12.34, 'USDC', 'USDC')).toBe(12.34);
    });

    it('converts XLM to USDC using baseline rates', () => {
      // 100 XLM * 0.15 = 15 USD / 1.00 = 15 USDC
      expect(convertAsset(100, 'XLM', 'USDC')).toBe(15);
    });

    it('converts USDC to EURC using baseline rates', () => {
      // 108 USDC * 1.00 = 108 USD / 1.08 = 100 EURC
      expect(convertAsset(108, 'USDC', 'EURC')).toBe(100);
    });

    it('uses custom rates when provided', () => {
      const customRates = { XLM: 0.2, USDC: 1.0, EURC: 1.1 };
      // 100 XLM * 0.2 = 20 USD / 1.0 = 20 USDC
      expect(convertAsset(100, 'XLM', 'USDC', customRates)).toBe(20);
    });
  });

  describe('convertToUsd', () => {
    it('calculates USD equivalent for supported assets', () => {
      expect(convertToUsd(100, 'XLM')).toBe(15); // 100 * 0.15
      expect(convertToUsd(50, 'USDC')).toBe(50); // 50 * 1.0
      expect(convertToUsd(10, 'EURC')).toBe(10.8); // 10 * 1.08
    });

    it('calculates USD equivalent with custom rates', () => {
      const customRates = { XLM: 0.5, USDC: 1.0, EURC: 1.2 };
      expect(convertToUsd(100, 'XLM', customRates)).toBe(50);
    });
  });

  describe('fetchOracleRates', () => {
    it('falls back cleanly to baseline values when contract is not configured', async () => {
      const result = await fetchOracleRates();
      expect(result).toBeDefined();
      expect(result.rates.XLM).toBe(BASELINE_RATES.XLM);
      expect(result.rates.USDC).toBe(BASELINE_RATES.USDC);
      expect(result.rates.EURC).toBe(BASELINE_RATES.EURC);
      expect(result.source).toBe('fallback');
      expect(result.isStale).toBe(false);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});
