'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { Goal, RoundUpRule } from '@/lib/types/savings'

interface RoundUpSettingsProps {
  goal: Goal
  onUpdateRule: (goalId: string, rule: RoundUpRule) => void
}

const NEAREST_UNITS = [1, 5, 10, 25, 50, 100]

/**
 * Component that controls round-up savings settings for a specific goal.
 * It allows the user to enable or disable round-ups, set the nearest unit to round up to (e.g., 1, 5, 10 XLM),
 * and pause or resume the round-up rule.
 * 
 * @param {RoundUpSettingsProps} props - The component props.
 * @param {Goal} props.goal - The goal for which round-up settings are being configured.
 * @param {(goalId: string, rule: RoundUpRule) => void} props.onUpdateRule - Callback function to update the round-up rule for the goal.
 */
export function RoundUpSettings({ goal, onUpdateRule }: RoundUpSettingsProps) {
  const [selectedUnit, setSelectedUnit] = useState(
    goal.roundUpRule?.nearestUnit ?? 1,
  )
  const [enabled, setEnabled] = useState(goal.roundUpRule?.enabled ?? false)
  const [paused, setPaused] = useState(goal.roundUpRule?.paused ?? false)
  const { toast } = useToast()

  const handleSave = () => {
    const rule: RoundUpRule = {
      enabled,
      nearestUnit: selectedUnit,
      paused: paused && enabled,
    }
    onUpdateRule(goal.id, rule)
    toast({
      title: enabled ? 'Round-Up Enabled' : 'Round-Up Disabled',
      description: enabled
        ? `Round-ups to nearest ${selectedUnit} XLM for "${goal.name}"`
        : `Round-ups disabled for "${goal.name}"`,
    })
  }

  const handlePauseToggle = () => {
    if (!enabled) return
    const newPaused = !paused
    setPaused(newPaused)
    const rule: RoundUpRule = {
      enabled,
      nearestUnit: selectedUnit,
      paused: newPaused,
    }
    onUpdateRule(goal.id, rule)
    toast({
      title: newPaused ? 'Round-Up Paused' : 'Round-Up Resumed',
      description: newPaused
        ? `Round-ups paused for "${goal.name}". Future transactions will not be rounded up.`
        : `Round-ups resumed for "${goal.name}". Future transactions will be rounded up again.`,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Round-Up Savings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Round up transactions and contribute the difference
          </span>
          <button
            onClick={() => {
              setEnabled(!enabled)
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Round up to nearest</p>
              <div className="grid grid-cols-3 gap-2">
                {NEAREST_UNITS.map((unit) => (
                  <Button
                    key={unit}
                    variant={selectedUnit === unit ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedUnit(unit)}
                  >
                    {unit} XLM
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                A transaction of 4.30 XLM with &quot;nearest 1 XLM&quot; adds 0.70 XLM
                to this goal.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {paused ? 'Paused' : 'Active'}
              </span>
              <button
                onClick={handlePauseToggle}
                disabled={!enabled}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  paused
                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                }`}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
            </div>

            <Button onClick={handleSave} className="w-full" variant="default">
              Save Round-Up Settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
