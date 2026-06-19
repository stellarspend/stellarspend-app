'use client'

import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Progress } from '../ui/progress'
import { FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { useToast } from '../ui/use-toast'

interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  recurrence: 'once' | 'monthly' | 'yearly'
  createdAt: Date
}

interface ContributionWidgetProps {
  goal: Goal
  onContribute: (goalId: string, amount: number) => void
  availableBalance: number
  contributionHistory?: ContributionHistoryEntry[]
}

export interface ContributionHistoryEntry {
  id?: string
  date: string | Date
  amount: number
  runningTotal?: number
}

const QUICK_AMOUNTS = [10, 25, 50, 100]
const MAX_VISIBLE_CONTRIBUTIONS = 5

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

function formatContributionDate(date: string | Date) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getVisibleContributions(contributionHistory?: ContributionHistoryEntry[]) {
  if (!contributionHistory?.length) {
    return []
  }

  let runningTotal = 0
  return [...contributionHistory]
    .sort(
      (first, second) => new Date(first.date).getTime() - new Date(second.date).getTime()
    )
    .map((entry) => {
      runningTotal = Number((runningTotal + entry.amount).toFixed(2))
      return {
        ...entry,
        runningTotal: entry.runningTotal ?? runningTotal,
      }
    })
    .slice(-MAX_VISIBLE_CONTRIBUTIONS)
    .reverse()
}

export function ContributionWidget({
  goal,
  onContribute,
  availableBalance,
  contributionHistory,
}: ContributionWidgetProps) {
  const [open, setOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const { toast } = useToast()

  const progress = (goal.currentAmount / goal.targetAmount) * 100
  const remainingAmount = goal.targetAmount - goal.currentAmount
  const visibleContributions = getVisibleContributions(contributionHistory)

  const handleQuickContribution = (amount: number) => {
    if (amount > availableBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You only have $${availableBalance.toFixed(2)} available`,
        variant: 'destructive',
      })
      return
    }

    setIsAnimating(true)
    onContribute(goal.id, amount)
    toast({
      title: 'Contribution Added',
      description: `$${amount.toFixed(2)} contributed to "${goal.name}"`,
    })
    setTimeout(() => setIsAnimating(false), 500)
  }

  const handleCustomContribution = (e: FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(customAmount)

    if (!customAmount || isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      })
      return
    }

    if (amount > availableBalance) {
      toast({
        title: 'Insufficient Balance',
        description: `You only have $${availableBalance.toFixed(2)} available`,
        variant: 'destructive',
      })
      return
    }

    setIsAnimating(true)
    onContribute(goal.id, amount)
    toast({
      title: 'Contribution Added',
      description: `$${amount.toFixed(2)} contributed to "${goal.name}"`,
    })
    setCustomAmount('')
    setOpen(false)
    setTimeout(() => setIsAnimating(false), 500)
  }

  return (
    <Card className={`transition-all duration-500 ${isAnimating ? 'ring-2 ring-green-500' : ''}`}>
      <CardHeader>
        <CardTitle>{goal.name}</CardTitle>
        <CardDescription>
          ${goal.currentAmount.toFixed(2)} of ${goal.targetAmount.toFixed(2)} • {remainingAmount.toFixed(2)} to go
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Quick Contribution</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => handleQuickContribution(amount)}
                disabled={amount > availableBalance}
              >
                ${amount}
              </Button>
            ))}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="w-full">
              Custom Amount
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contribute to {goal.name}</DialogTitle>
              <DialogDescription>
                Available balance: ${availableBalance.toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCustomContribution} className="space-y-4">
              <FieldGroup >
                <FieldLabel htmlFor="contribution">Amount ($)</FieldLabel>
                <Input
                  id="contribution"
                  type="number"
                  placeholder="Enter amount"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  autoFocus
                />
              </FieldGroup>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Contribute</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground">
          Deadline: {new Date(goal.deadline).toLocaleDateString()}
        </p>

        <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Contribution History</p>
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs">
              View all
            </Button>
          </div>

          {visibleContributions.length > 0 ? (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[11px] uppercase text-muted-foreground">
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Total</span>
              </div>
              {visibleContributions.map((entry, index) => (
                <div
                  key={entry.id ?? `${new Date(entry.date).toISOString()}-${index}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs"
                >
                  <span className="truncate text-muted-foreground">
                    {formatContributionDate(entry.date)}
                  </span>
                  <span className="text-right font-medium">
                    {formatCurrency(entry.amount)}
                  </span>
                  <span className="text-right font-semibold">
                    {formatCurrency(entry.runningTotal ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No contributions yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
