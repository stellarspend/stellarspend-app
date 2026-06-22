'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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

const QUICK_AMOUNTS = [10, 25, 50, 100]

export function ContributionWidget({ goal, onContribute, availableBalance }: ContributionWidgetProps) {
  const [open, setOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const [hasCelebratedCompletion, setHasCelebratedCompletion] = useState(
    goal.currentAmount >= goal.targetAmount
  )
  const [showCompletion, setShowCompletion] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const { toast } = useToast()

  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0)

  useEffect(() => {
    setHasCelebratedCompletion(goal.currentAmount >= goal.targetAmount)
    setShowCompletion(false)
  }, [goal.id, goal.currentAmount, goal.targetAmount])

  const celebrateIfCompleted = (amount: number) => {
    const willComplete =
      !hasCelebratedCompletion && goal.currentAmount < goal.targetAmount &&
      goal.currentAmount + amount >= goal.targetAmount

    if (!willComplete) return

    setHasCelebratedCompletion(true)
    setShowCompletion(true)
    toast({
      title: 'Goal Complete',
      description: `"${goal.name}" reached 100%. Great work!`,
    })

    window.setTimeout(() => setShowCompletion(false), prefersReducedMotion ? 1800 : 2800)
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
    onContribute(goal.id, amount)
    celebrateIfCompleted(amount)
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
    celebrateIfCompleted(amount)
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

        <AnimatePresence>
          {showCompletion && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: 'easeOut' }}
              className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-300"
            >
              Goal complete! {goal.name} reached 100%.
            </motion.div>
          )}
        </AnimatePresence>

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
      </CardContent>
    </Card>
  )
}
