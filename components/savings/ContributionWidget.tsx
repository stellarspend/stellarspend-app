'use client'

import { useState } from 'react'
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
}

interface ContributionEntry {
  id: string
  date: string
  amount: number
  runningTotal: number
}

const QUICK_AMOUNTS = [10, 25, 50, 100]

function formatContributionDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ContributionWidget({ goal, onContribute, availableBalance }: ContributionWidgetProps) {
  const [open, setOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const [contributionHistory, setContributionHistory] = useState<ContributionEntry[]>(() =>
    goal.currentAmount > 0
      ? [
          {
            id: `${goal.id}-initial`,
            date: goal.createdAt.toISOString(),
            amount: goal.currentAmount,
            runningTotal: goal.currentAmount,
          },
        ]
      : [],
  )
  const { toast } = useToast()

  const progress = (goal.currentAmount / goal.targetAmount) * 100
  const remainingAmount = goal.targetAmount - goal.currentAmount
  const recentContributions = contributionHistory.slice(0, 5)

  const recordContribution = (amount: number) => {
    const nextRunningTotal = goal.currentAmount + amount

    setContributionHistory((previousHistory) => [
      {
        id: `${goal.id}-${Date.now()}`,
        date: new Date().toISOString(),
        amount,
        runningTotal: nextRunningTotal,
      },
      ...previousHistory,
    ])
  }

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
    recordContribution(amount)
    onContribute(goal.id, amount)
    toast({
      title: 'Contribution Added',
      description: `$${amount.toFixed(2)} contributed to "${goal.name}"`,
    })
    setTimeout(() => setIsAnimating(false), 500)
  }

  const handleCustomContribution = (e: React.FormEvent) => {
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
    recordContribution(amount)
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

        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Contribution History</p>
            <a
              href={`/dashboard/savings?goal=${goal.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </a>
          </div>
          {recentContributions.length > 0 ? (
            <div className="space-y-2">
              {recentContributions.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-medium">${entry.amount.toFixed(2)}</p>
                    <p className="text-muted-foreground">
                      {formatContributionDate(entry.date)}
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    Total ${entry.runningTotal.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No contributions yet.
            </p>
          )}
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
      </CardContent>
    </Card>
  )
}
