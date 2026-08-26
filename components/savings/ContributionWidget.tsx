'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Progress } from '../ui/progress'
import { FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { useToast } from '../ui/use-toast'
import { RoundUpSettings } from './RoundUpSettings'
import { ContributionHistory } from './ContributionHistory'
import type { Goal, Contribution, RoundUpRule, GoalSchedule } from '@/lib/types/savings'

interface ContributionWidgetProps {
  goal: Goal
  contributions: Contribution[]
  onContribute: (goalId: string, amount: number) => void
  availableBalance: number
  onUpdateSchedule: (goalId: string, schedule: GoalSchedule | undefined) => void
  onUpdateRoundUpRule: (goalId: string, rule: RoundUpRule) => void
}

const QUICK_AMOUNTS = [10, 25, 50, 100]

export function ContributionWidget({
  goal,
  contributions,
  onContribute,
  availableBalance,
  onUpdateSchedule,
  onUpdateRoundUpRule,
}: ContributionWidgetProps) {
  const [open, setOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { toast } = useToast()

  const progress = (goal.currentAmount / goal.targetAmount) * 100
  const remainingAmount = goal.targetAmount - goal.currentAmount
  const goalContributions = contributions.filter((c) => c.goalId === goal.id)

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
    onContribute(goal.id, amount)
    toast({
      title: 'Contribution Added',
      description: `$${amount.toFixed(2)} contributed to "${goal.name}"`,
    })
    setCustomAmount('')
    setOpen(false)
    setTimeout(() => setIsAnimating(false), 500)
  }

  const handlePauseSchedule = () => {
    if (!goal.schedule) return
    const newSchedule = { ...goal.schedule, paused: !goal.schedule.paused }
    onUpdateSchedule(goal.id, newSchedule)
    toast({
      title: newSchedule.paused ? 'Schedule Paused' : 'Schedule Resumed',
      description: newSchedule.paused
        ? `Recurring contributions for "${goal.name}" are paused.`
        : `Recurring contributions for "${goal.name}" have resumed.`,
    })
  }

  const handleCancelSchedule = () => {
    if (!goal.schedule) return
    if (!confirm(`Cancel recurring contributions for "${goal.name}"?`)) return
    onUpdateSchedule(goal.id, undefined)
    toast({
      title: 'Schedule Cancelled',
      description: `Recurring contributions for "${goal.name}" have been cancelled.`,
    })
  }

  return (
    <Card className={`transition-all duration-500 ${isAnimating ? 'ring-2 ring-green-500' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{goal.name}</CardTitle>
            <CardDescription>
              ${goal.currentAmount.toFixed(2)} of ${goal.targetAmount.toFixed(2)} &bull; {remainingAmount.toFixed(2)} to go
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <button
              className="inline-flex items-center justify-center rounded-md font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm"
              onClick={() => setShowHistory(!showHistory)}
              title="History"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Schedule info */}
        {goal.schedule && (
          <div className={`flex items-center justify-between p-2 rounded-md text-xs ${
            goal.schedule.paused
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
              : 'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200'
          }`}>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>
                {goal.schedule.paused ? 'Paused' : 'Active'} &bull;{' '}
                {goal.schedule.amount.toFixed(2)} XLM / {goal.recurrence === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handlePauseSchedule}
                className="px-2 py-0.5 rounded text-xs font-medium hover:bg-white/50 dark:hover:bg-black/20"
              >
                {goal.schedule.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleCancelSchedule}
                className="px-2 py-0.5 rounded text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Round-up status */}
        {goal.roundUpRule?.enabled && (
          <div className={`flex items-center gap-1.5 p-2 rounded-md text-xs ${
            goal.roundUpRule.paused
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>
              Round-up {goal.roundUpRule.paused ? 'paused' : 'active'} &bull; nearest {goal.roundUpRule.nearestUnit} XLM
            </span>
          </div>
        )}

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
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  autoFocus
                />
              </FieldGroup>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" aria-label="Add contribution">Contribute</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground">
          Deadline: {new Date(goal.deadline).toLocaleDateString()}
        </p>

        {/* Settings panel */}
        {showSettings && (
          <div className="pt-2 border-t">
            <RoundUpSettings
              goal={goal}
              onUpdateRule={onUpdateRoundUpRule}
            />
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div className="pt-2 border-t">
            <ContributionHistory
              contributions={goalContributions}
              goalName={goal.name}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
