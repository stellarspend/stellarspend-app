'use client'

import { useState } from "react";
import BalancesWidget from "@/components/dashboard/BalancesWidget";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import GoalForm from "@/components/savings/GoalForm";
import {
  ContributionWidget,
  type ContributionHistoryEntry,
} from "@/components/savings/ContributionWidget";

interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  recurrence: 'once' | 'monthly' | 'yearly'
  createdAt: Date
}

interface GoalFormData {
  title: string;
  targetAmount: number;
  deadline: string;
  recurrence: 'once' | 'monthly' | 'yearly';
}

export default function DashboardPage() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      name: 'New Laptop',
      targetAmount: 1200,
      currentAmount: 300,
      deadline: '2024-12-31',
      recurrence: 'once',
      createdAt: new Date(),
    },
  ]);
  const [contributionHistory, setContributionHistory] = useState<
    Record<string, ContributionHistoryEntry[]>
  >({});
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const availableBalance = 500; // Mock balance

  const handleGoalCreated = (goalData: GoalFormData) => {
    const newGoal: Goal = {
      id: Math.random().toString(36).substring(2, 11),
      name: goalData.title,
      targetAmount: goalData.targetAmount,
      currentAmount: 0,
      deadline: goalData.deadline,
      recurrence: goalData.recurrence,
      createdAt: new Date(),
    };
    setGoals(prev => [...prev, newGoal]);
  };

  const handleContribute = (goalId: string, amount: number) => {
    const currentGoal = goals.find(goal => goal.id === goalId);
    if (!currentGoal) return;

    const nextTotal = Number((currentGoal.currentAmount + amount).toFixed(2));

    setGoals(prev => prev.map(goal =>
      goal.id === goalId
        ? { ...goal, currentAmount: nextTotal }
        : goal
    ));
    setContributionHistory(prev => {
      const previousHistory = prev[goalId] ?? [];

      return {
        ...prev,
        [goalId]: [
          ...previousHistory,
          {
            id: `${goalId}-${Date.now()}`,
            date: new Date(),
            amount,
            runningTotal: nextTotal,
          },
        ],
      };
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page heading */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full border border-[#e8b84b]/20 bg-[#e8b84b]/[0.08] text-[#e8b84b]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#e8b84b] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Live Overview
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Good day, <span className="text-[#e8b84b]">Stellar</span> user
        </h1>
        <p className="text-[#7a8aaa] mt-1 text-sm max-w-md">
          Here&apos;s a snapshot of your portfolio and recent blockchain activity.
        </p>
      </div>

      {/* Balances */}
      <BalancesWidget />

      {/* Quick Actions */}
      <QuickActions />

      {/* Savings Goals */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Savings Goals</h2>
          <button
            onClick={() => setGoalModalOpen(true)}
            className="px-4 py-2 bg-[#e8b84b] text-black rounded-lg hover:bg-[#e8b84b]/90 transition-colors"
          >
            Create Goal
          </button>
        </div>
        {goals.length === 0 ? (
          <div className="text-center py-8 text-[#7a8aaa]">
            No savings goals yet. Create your first goal to start saving!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map(goal => (
              <ContributionWidget
                key={goal.id}
                goal={goal}
                onContribute={handleContribute}
                availableBalance={availableBalance}
                contributionHistory={contributionHistory[goal.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <RecentTransactions />

      <GoalForm
        open={goalModalOpen}
        onOpenChange={setGoalModalOpen}
        onGoalCreated={handleGoalCreated}
      />
    </div>
  );
}
