'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import type { Contribution } from '@/lib/types/savings'

interface ContributionHistoryProps {
  contributions: Contribution[]
  goalName: string
  /** Number of recent contributions to show initially (default: 5) */
  initialLimit?: number
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  'round-up': 'Round-Up',
}

const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'round-up': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
}

/**
 * Calculate running totals for contributions sorted chronologically (oldest first).
 * Returns contributions in reverse chronological order (newest first) with running totals.
 */
function calculateRunningTotals(contributions: Contribution[]): (Contribution & { runningTotal: number })[] {
  // Sort by date ascending (oldest first) to calculate running total
  const chronological = [...contributions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  let runningTotal = 0
  const withTotals = chronological.map((contribution) => {
    runningTotal += contribution.amount
    return { ...contribution, runningTotal }
  })

  // Return in reverse chronological order (newest first) for display
  return withTotals.reverse()
}

export function ContributionHistory({
  contributions,
  goalName,
  initialLimit = 5,
}: ContributionHistoryProps) {
  const [showAll, setShowAll] = useState(false)

  const contributionsWithTotals = calculateRunningTotals(contributions)
  const displayLimit = showAll ? contributionsWithTotals.length : initialLimit
  const displayedContributions = contributionsWithTotals.slice(0, displayLimit)
  const hasMore = contributionsWithTotals.length > initialLimit

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Contribution History</CardTitle>
          {contributions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {contributions.length} total
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No contributions yet for &quot;{goalName}&quot;
          </p>
        ) : (
          <div className="space-y-3">
            {/* Table header */}
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Running Total</span>
            </div>

            {/* Contribution rows */}
            {displayedContributions.map((contribution) => (
              <div
                key={contribution.id}
                className="grid grid-cols-3 gap-2 items-center py-2 border-b last:border-b-0"
              >
                <div className="space-y-1">
                  <p className="text-sm">
                    {new Date(contribution.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full inline-block ${SOURCE_COLORS[contribution.source]}`}
                  >
                    {SOURCE_LABELS[contribution.source]}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    +${contribution.amount.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">
                    ${contribution.runningTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {/* View all / Show less button */}
            {hasMore && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                      </svg>
                      Show less
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      View all ({contributionsWithTotals.length - initialLimit} more)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
