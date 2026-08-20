import { describe, expect, test, jest } from '@jest/globals'

import {
  buildAnalyticsFilename,
  exportToCsv,
  serializeAnalyticsToCsv,
  type AnalyticsExportData,
} from '../exportAnalytics'
import type {
  BudgetVsActualEntry,
  CategoryBreakdownEntry,
  SpendingTrendPoint,
} from '../analyticsContract'

const sampleData = (): AnalyticsExportData => {
  const trend: SpendingTrendPoint[] = [
    { bucketStart: 1_704_067_200, asset: 'XLM', totalSpent: '15000000' },
  ]
  const categoryBreakdown: CategoryBreakdownEntry[] = [
    {
      categoryId: 'food',
      categoryLabel: 'Food, groceries',
      asset: 'USDC',
      totalSpent: '25000000',
      transactionCount: 4,
    },
  ]
  const budgetVsActual: BudgetVsActualEntry[] = [
    {
      budgetId: 'b1',
      categoryId: 'food',
      categoryLabel: 'Food',
      asset: 'USDC',
      budgetedAmount: '50000000',
      actualSpent: '25000000',
    },
  ]
  return { trend, categoryBreakdown, budgetVsActual }
}

describe('exportAnalytics', () => {
  test('serializeAnalyticsToCsv includes required headers', () => {
    const csv = serializeAnalyticsToCsv({
      trend: [],
      categoryBreakdown: [],
      budgetVsActual: [],
    })

    expect(csv).toContain('date,category,amount,asset')
  })

  test('serializeAnalyticsToCsv writes trend, category, and budget rows', () => {
    const csv = serializeAnalyticsToCsv(sampleData())

    expect(csv).toContain('trend,2024-01-01,,1.5,XLM')
    expect(csv).toContain('"Food, groceries"')
    expect(csv).toContain('category,,"Food, groceries",2.5,USDC,,4')
    expect(csv).toContain('budget,,Food,2.5,USDC,5,')
  })

  test('buildAnalyticsFilename uses range and ISO date', () => {
    const filename = buildAnalyticsFilename('quarter', new Date('2026-08-20T12:00:00.000Z'))
    expect(filename).toBe('stellarspend-analytics-quarter-2026-08-20.csv')
  })

  test('exportToCsv triggers a browser download with a CSV blob', () => {
    const click = jest.fn()
    const appendChild = jest.fn()
    const removeChild = jest.fn()
    const createObjectURL = jest.fn(() => 'blob:mock-url')
    const revokeObjectURL = jest.fn()

    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const originalCreateElement = document.createElement.bind(document)

    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          style: { display: '' },
          click,
        } as unknown as HTMLAnchorElement
      }
      return originalCreateElement(tagName)
    })
    jest.spyOn(document.body, 'appendChild').mockImplementation(appendChild as typeof document.body.appendChild)
    jest.spyOn(document.body, 'removeChild').mockImplementation(removeChild as typeof document.body.removeChild)

    exportToCsv(sampleData(), 'stellarspend-analytics-month-2026-08-20.csv')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toContain('text/csv')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    jest.restoreAllMocks()
  })
})
