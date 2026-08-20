/**
 * lib/api/stellar/exportAnalytics.ts
 *
 * Serializes currently displayed analytics data to CSV and triggers a
 * browser download. Used by the analytics dashboard so users can share
 * spending history with a bank or microfinance institution.
 *
 * The export always reflects the data already fetched for the selected
 * TimeRange — it does not re-query the contract.
 */

import type {
  BudgetVsActualEntry,
  CategoryBreakdownEntry,
  SpendingTrendPoint,
  TimeRange,
} from './analyticsContract'
import { stroopsToDisplay } from './formatAmount'

export interface AnalyticsExportData {
  trend: SpendingTrendPoint[]
  categoryBreakdown: CategoryBreakdownEntry[]
  budgetVsActual: BudgetVsActualEntry[]
}

const CSV_HEADERS = [
  'type',
  'date',
  'category',
  'amount',
  'asset',
  'budgeted',
  'transaction_count',
] as const

const unixToIsoDate = (unixSeconds: number): string => {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

const formatCsvAmount = (amount: string, asset: SpendingTrendPoint['asset']): string => {
  const value = stroopsToDisplay(amount, asset)
  if (!Number.isFinite(value)) return amount
  return value.toFixed(7).replace(/\.?0+$/, '')
}

const escapeCsvField = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const toCsvRow = (fields: string[]): string => fields.map(escapeCsvField).join(',')

/**
 * Builds a CSV string with at least date, category, amount, and asset
 * columns from trend, category breakdown, and budget-vs-actual data.
 */
export const serializeAnalyticsToCsv = (data: AnalyticsExportData): string => {
  const rows: string[] = [toCsvRow([...CSV_HEADERS])]

  for (const point of data.trend) {
    rows.push(
      toCsvRow([
        'trend',
        unixToIsoDate(point.bucketStart),
        '',
        formatCsvAmount(point.totalSpent, point.asset),
        point.asset,
        '',
        '',
      ]),
    )
  }

  for (const entry of data.categoryBreakdown) {
    rows.push(
      toCsvRow([
        'category',
        '',
        entry.categoryLabel,
        formatCsvAmount(entry.totalSpent, entry.asset),
        entry.asset,
        '',
        String(entry.transactionCount),
      ]),
    )
  }

  for (const entry of data.budgetVsActual) {
    rows.push(
      toCsvRow([
        'budget',
        '',
        entry.categoryLabel,
        formatCsvAmount(entry.actualSpent, entry.asset),
        entry.asset,
        formatCsvAmount(entry.budgetedAmount, entry.asset),
        '',
      ]),
    )
  }

  return `\uFEFF${rows.join('\n')}\n`
}

export const buildAnalyticsFilename = (
  range: TimeRange,
  now: Date = new Date(),
): string => {
  const date = now.toISOString().slice(0, 10)
  return `stellarspend-analytics-${range}-${date}.csv`
}

/**
 * Serializes analytics data to a CSV Blob and triggers a browser download.
 */
export const exportToCsv = (data: AnalyticsExportData, filename: string): void => {
  if (typeof document === 'undefined') {
    throw new Error('CSV export is only available in the browser.')
  }

  const csv = serializeAnalyticsToCsv(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
