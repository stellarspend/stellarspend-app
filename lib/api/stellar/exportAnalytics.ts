import type {
  SpendingTrendPoint,
  CategoryBreakdownEntry,
  BudgetVsActualEntry,
  TimeRange,
} from './analyticsContract';

export interface ExportPayload {
  range: TimeRange;
  trend: SpendingTrendPoint[];
  categoryBreakdown: CategoryBreakdownEntry[];
  budgetVsActual: BudgetVsActualEntry[];
}

function escapeCsv(value: unknown) {
  const s = value == null ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

export function exportToCsv(payload: ExportPayload, filename = 'stellarspend-analytics.csv') {
  const rows: string[][] = [];

  // Header
  rows.push(['date', 'category', 'amount', 'asset', 'source']);

  // Trend: date -> bucketStart
  for (const p of payload.trend) {
    const date = new Date(p.bucketStart * 1000).toISOString().split('T')[0];
    rows.push([date, '', p.totalSpent, p.asset, 'trend']);
  }

  // Category breakdown
  for (const c of payload.categoryBreakdown) {
    rows.push(['', c.categoryLabel, c.totalSpent, c.asset, 'category']);
  }

  // Budget vs actual (export actual spent)
  for (const b of payload.budgetVsActual) {
    rows.push(['', b.categoryLabel, b.actualSpent, b.asset, 'budget']);
  }

  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default exportToCsv;
