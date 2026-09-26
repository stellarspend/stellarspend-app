import type { Metadata } from 'next';
import { describe, expect, test } from '@jest/globals';

// Every dashboard tab must own a metadata export so the browser tab title
// reflects the active route. The Analytics route was covered by issue #309;
// this pins the whole set so a new tab cannot silently ship untitled.
import { metadata as analyticsMetadata } from '../analytics/layout';
import { metadata as budgetsMetadata } from '../budgets/layout';
import { metadata as settingsMetadata } from '../settings/layout';
import { metadata as spendingLimitsMetadata } from '../spending-limits/layout';
import { metadata as transactionsMetadata } from '../transactions/layout';

const ROUTES: Array<[string, Metadata]> = [
  ['Analytics', analyticsMetadata],
  ['Budgets', budgetsMetadata],
  ['Settings', settingsMetadata],
  ['Spending Limits', spendingLimitsMetadata],
  ['Transactions', transactionsMetadata],
];

describe('dashboard route metadata', () => {
  test.each(ROUTES)('%s exposes a StellarSpend tab title', (label, meta) => {
    expect(meta.title).toBe(`${label} | StellarSpend`);
  });

  test('no two tabs share the same title', () => {
    const titles = ROUTES.map(([, meta]) => meta.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
