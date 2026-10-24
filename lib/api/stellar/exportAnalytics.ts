import {
  SpendingTrendPoint,
  CategoryBreakdownEntry,
  BudgetVsActualEntry,
} from './analyticsContract';
import { stroopsToDisplay } from './formatAmount';

export interface AnalyticsExportData {
  trend: SpendingTrendPoint[];
  categoryBreakdown: CategoryBreakdownEntry[];
  budgetVsActual?: BudgetVsActualEntry[];
}

function formatDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * Exports analytics data to a CSV file and triggers a browser download.
 *
 * @param data - The analytics data to export, including trend and category breakdown.
 * @param filename - The target CSV filename for download.
 * @returns void
 */
export function exportToCsv(data: AnalyticsExportData, filename: string): void {
  const rows: string[] = [];

  // CSV Header
  rows.push(['date', 'category', 'amount', 'asset'].join(','));

  // 1. Spending Trend data rows
  for (const point of data.trend) {
    const date = formatDate(point.bucketStart);
    const amount = stroopsToDisplay(point.totalSpent, point.asset);
    rows.push([date, 'Trend', amount.toString(), point.asset].join(','));
  }

  // 2. Category Breakdown data rows
  const today = new Date().toISOString().split('T')[0];
  for (const item of data.categoryBreakdown) {
    const label = item.categoryLabel || item.categoryId;
    const amount = stroopsToDisplay(item.totalSpent, item.asset);
    rows.push([today, `"${label}"`, amount.toString(), item.asset].join(','));
  }

  const csvString = rows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
