import { describe, beforeEach, expect, test } from '@jest/globals';
import {
  getLimits,
  setLimit,
  getRemaining,
  recordSpend,
  deleteLimit,
  normalizeLimit,
  getPeriodDurationMs,
  SpendingLimit,
} from '../spendingLimitsContract';

describe('spendingLimitsContract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getPeriodDurationMs returns expected milliseconds', () => {
    expect(getPeriodDurationMs('daily')).toBe(24 * 60 * 60 * 1000);
    expect(getPeriodDurationMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(getPeriodDurationMs('monthly')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test('getLimits returns fallback limits when empty', async () => {
    const limits = await getLimits('GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO');
    expect(Array.isArray(limits)).toBe(true);
    expect(limits.length).toBeGreaterThanOrEqual(1);
    const usdcLimit = limits.find((l) => l.asset === 'USDC');
    expect(usdcLimit).toBeDefined();
    expect(usdcLimit?.limitAmount).toBe(500);
  });

  test('setLimit creates and stores a new spending limit', async () => {
    const user = 'GTEST123';
    const limit = await setLimit(user, 'XLM', 300, 'weekly');
    expect(limit.asset).toBe('XLM');
    expect(limit.limitAmount).toBe(300);
    expect(limit.period).toBe('weekly');
    expect(limit.spentAmount).toBe(0);

    const allLimits = await getLimits(user);
    const saved = allLimits.find((l) => l.asset === 'XLM');
    expect(saved).toBeDefined();
    expect(saved?.limitAmount).toBe(300);
  });

  test('getRemaining calculates remaining allowance accurately', async () => {
    const user = 'GTEST_REMAINING';
    await setLimit(user, 'USDC', 100, 'weekly');
    
    // Initial remaining
    let remaining = await getRemaining(user, 'USDC');
    expect(remaining).not.toBeNull();
    expect(remaining?.hasLimit).toBe(true);
    expect(remaining?.remainingAmount).toBe(100);
    expect(remaining?.spentAmount).toBe(0);

    // Record spend 80 USDC
    await recordSpend(user, 'USDC', 80);
    remaining = await getRemaining(user, 'USDC');
    expect(remaining?.remainingAmount).toBe(20);
    expect(remaining?.spentAmount).toBe(80);
  });

  test('getRemaining returns null for asset without limits', async () => {
    const user = 'GTEST_NO_LIMIT';
    localStorage.setItem('stellarspend_local_spending_limits', JSON.stringify([]));
    const remaining = await getRemaining(user, 'EURC');
    expect(remaining).toBeNull();
  });

  test('deleteLimit removes limit by id or asset', async () => {
    const user = 'GTEST_DELETE';
    await setLimit(user, 'EURC', 250, 'monthly');
    let limits = await getLimits(user);
    expect(limits.some((l) => l.asset === 'EURC')).toBe(true);

    await deleteLimit(user, 'EURC');
    limits = await getLimits(user);
    expect(limits.some((l) => l.asset === 'EURC')).toBe(false);
  });

  test('normalizeLimit resets spentAmount if time window elapsed', () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const weeklyLimit: SpendingLimit = {
      id: 'test_limit',
      publicKey: 'GTEST',
      asset: 'USDC',
      limitAmount: 200,
      spentAmount: 150,
      period: 'weekly', // 7 days
      periodStart: pastDate,
      createdAt: pastDate,
      updatedAt: pastDate,
    };

    const normalized = normalizeLimit(weeklyLimit);
    expect(normalized.spentAmount).toBe(0);
    expect(new Date(normalized.periodStart).getTime()).toBeGreaterThan(new Date(pastDate).getTime());
  });
});
