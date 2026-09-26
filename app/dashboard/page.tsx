'use client'

import { useState, useEffect } from "react";
import BalancesWidget from "@/components/dashboard/BalancesWidget";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import GoalForm from "@/components/savings/GoalForm";
import { ContributionWidget } from "@/components/savings/ContributionWidget";
import SplitBillModal from "@/components/payments/SplitBillModal";
import PendingSplitCard from "@/components/payments/PendingSplitCard";
import useWallet from "@/hooks/useWallet";
import { useOffline } from "@/components/offline/OfflineProvider";
import { useToast } from "@/components/ui/use-toast";
import type { Goal, Contribution, GoalSchedule, RoundUpRule } from "@/lib/types/savings";
import type { SplitBill } from "@/lib/types/splits";
import {
  fetchGoals,
  contributeToGoal,
  getMockGoalsFallback,
  setMockGoalsFallback,
  getContributionHistoryOnChain,
  setRoundUpRuleOnChain,
  pauseScheduleOnChain,
  resumeScheduleOnChain,
  cancelScheduleOnChain,
  applyRoundUpOnChain,
} from "@/lib/stellar/savingsGoalContract";
import {
  checkAndExecuteDueContributions,
  applyRoundUpToGoals,
  loadContributions as loadLocalContributions,
} from "@/lib/savings/scheduler";
import { PAYMENT_CONFIRMED_EVENT } from "@/lib/stellar/submitTransaction";
import { fetchSplitsForUser } from "@/lib/stellar/escrowContract";

export default function DashboardPage() {
  const { freighter } = useWallet();
  const publicKey = freighter.publicKey;
  const { isOnline, queueAction } = useOffline();
  const { toast } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [splits, setSplits] = useState<SplitBill[]>([]);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const availableBalance = 500;

  useEffect(() => {
    async function loadSplits() {
      if (!publicKey) {
        setSplits([]);
        return;
      }
      try {
        const userSplits = await fetchSplitsForUser(publicKey);
        setSplits(userSplits);
      } catch (e) {
        console.error("Failed to load splits:", e);
      }
    }
    loadSplits();
  }, [publicKey]);

  const handleSplitCreated = (split: SplitBill) => {
    setSplits((prev) => [split, ...prev]);
    setSplitModalOpen(false);
  };

  const handleSplitUpdated = (updated: SplitBill) => {
    setSplits((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  useEffect(() => {
    async function loadGoals() {
      if (publicKey) {
        try {
          const contractGoals = await fetchGoals(publicKey);
          setGoals(contractGoals);
        } catch (e) {
          console.error(e);
          setGoals(getMockGoalsFallback());
        }
      } else {
        setGoals(getMockGoalsFallback());
      }
    }
    loadGoals();
  }, [publicKey]);

  // Load contributions for goals
  useEffect(() => {
    async function loadAllContributions() {
      if (publicKey && goals.length > 0) {
        try {
          const allContribs: Contribution[] = [];
          for (const goal of goals) {
            try {
              const history = await getContributionHistoryOnChain(goal.id, publicKey);
              allContribs.push(...history);
            } catch (err) {
              console.error(`Failed to fetch history for goal ${goal.id}:`, err);
            }
          }
          setContributions(allContribs);
        } catch (e) {
          console.error("Failed to load contribution history:", e);
        }
      }
    }
    loadAllContributions();
  }, [goals, publicKey]);

  // Load local (mock) contributions once on mount so manual/scheduled/
  // round-up contributions made without a connected wallet are visible in
  // the contribution history UI, matching what happens with a wallet.
  useEffect(() => {
    async function loadLocal() {
      if (!publicKey) {
        setContributions(loadLocalContributions());
      }
    }
    loadLocal();
  }, [publicKey]);

  const handleGoalCreated = (newGoal: Goal) => {
    setGoals(prev => [...prev, newGoal]);
  };

  const handleContribute = async (goalId: string, amount: number) => {
    if (!isOnline) {
      queueAction('CONTRIBUTE_GOAL', `Contribute to goal: ${goalId}`, { goalId, amount });
      toast({
        title: "Contribution Queued",
        description: "Offline: Your contribution has been queued and will be processed when you reconnect.",
      });
      // Optimistic UI update
      setGoals(prev => prev.map(goal =>
        goal.id === goalId
          ? { ...goal, currentAmount: goal.currentAmount + amount }
          : goal
      ));
      return;
    }

    if (publicKey) {
      try {
        await contributeToGoal(publicKey, goalId, amount);
        const contractGoals = await fetchGoals(publicKey);
        setGoals(contractGoals);
        toast({
          title: "Contribution Successful",
          description: `Successfully contributed ${amount} XLM to your goal.`,
        });
      } catch (e: unknown) {
        const errMessage = e instanceof Error ? e.message : String(e);
        toast({
          title: "Contribution Failed",
          description: errMessage,
          variant: "destructive",
        });
      }
    } else {
      // Local/mock fallback: persist through the same helper used by the
      // wallet-connected path so a Contribution record is actually created
      // (previously this branch only updated the in-memory goal amount).
      await contributeToGoal("", goalId, amount, "manual");
      setGoals(prev => prev.map(goal =>
        goal.id === goalId
          ? { ...goal, currentAmount: goal.currentAmount + amount }
          : goal
      ));
      setContributions(loadLocalContributions());
    }
  };

  const handleUpdateSchedule = async (goalId: string, schedule: GoalSchedule | undefined) => {
    if (publicKey) {
      try {
        if (!schedule) {
          await cancelScheduleOnChain(goalId, publicKey);
        } else if (schedule.paused) {
          await pauseScheduleOnChain(goalId, publicKey);
        } else {
          await resumeScheduleOnChain(goalId, publicKey);
        }
        const contractGoals = await fetchGoals(publicKey);
        setGoals(contractGoals);
      } catch (e) {
        console.error("Failed to update schedule:", e);
      }
      return;
    }

    // Local/mock fallback — previously this function did nothing at all
    // without a connected wallet, so pause/resume/cancel silently failed.
    setGoals(prev => {
      const updated = prev.map(goal =>
        goal.id === goalId ? { ...goal, schedule } : goal
      );
      setMockGoalsFallback(updated);
      return updated;
    });
    toast({
      title: schedule ? (schedule.paused ? "Schedule Paused" : "Schedule Resumed") : "Schedule Cancelled",
      description: schedule
        ? `Recurring contributions ${schedule.paused ? "paused" : "resumed"}.`
        : "Recurring contributions cancelled.",
    });
  };

  const handleUpdateRoundUpRule = async (goalId: string, rule: RoundUpRule) => {
    if (publicKey) {
      try {
        await setRoundUpRuleOnChain(goalId, rule.enabled, rule.nearestUnit, publicKey);
        const contractGoals = await fetchGoals(publicKey);
        setGoals(contractGoals);
      } catch (e) {
        console.error("Failed to update round-up rule:", e);
      }
      return;
    }

    // Local/mock fallback — same gap as handleUpdateSchedule above.
    setGoals(prev => {
      const updated = prev.map(goal =>
        goal.id === goalId ? { ...goal, roundUpRule: rule } : goal
      );
      setMockGoalsFallback(updated);
      return updated;
    });
  };

  // Recurring contributions are not executed automatically in the
  // background by this app — there is no server-side cron here, and this
  // app has no visibility into whether the on-chain contract runs one
  // either. This button is the honest, explicit "execute now" trigger:
  // it checks every goal's schedule and runs any contribution that's
  // actually due, rather than pretending due contributions happen on
  // their own.
  const handleCheckDueContributions = () => {
    const { updatedGoals, executedContributions } = checkAndExecuteDueContributions(
      goals,
      availableBalance,
    );
    setGoals(updatedGoals);
    if (!publicKey) {
      setMockGoalsFallback(updatedGoals);
    }
    if (executedContributions.length > 0) {
      setContributions(prev => [...prev, ...executedContributions]);
      toast({
        title: "Contributions Executed",
        description: `${executedContributions.length} due contribution${executedContributions.length === 1 ? "" : "s"} executed.`,
      });
    } else {
      toast({
        title: "Nothing Due",
        description: "No scheduled contributions are due right now.",
      });
    }
  };

  // Round-up savings: apply the spare change from a real confirmed payment
  // to every goal with an active round-up rule. This listens for the same
  // event the transaction list uses to show a payment go from pending to
  // confirmed — the closest thing this app has to a live transaction feed.
  useEffect(() => {
    function handlePaymentConfirmed(event: Event) {
      const payment = (event as CustomEvent<{ amount: string; hash: string }>).detail;
      if (!payment) return;
      const amount = parseFloat(payment.amount);
      if (isNaN(amount) || amount <= 0) return;

      setGoals(prevGoals => {
        const { updatedGoals, appliedContributions } = applyRoundUpToGoals(
          prevGoals,
          amount,
          payment.hash,
        );

        if (appliedContributions.length === 0) {
          return prevGoals;
        }

        if (!publicKey) {
          setMockGoalsFallback(updatedGoals);
        } else {
          // Best-effort mirror to the on-chain contract when one is
          // configured and a wallet is connected. This repo has no
          // visibility into the deployed contract's own round-up
          // execution, if any — this call is a pass-through, not a
          // guarantee it will be reflected until the next chain refresh.
          appliedContributions.forEach((contribution) => {
            applyRoundUpOnChain(
              contribution.goalId,
              contribution.transactionHash ?? payment.hash,
              contribution.amount,
              publicKey,
            ).catch((e) => console.error("Failed to apply round-up on-chain:", e));
          });
        }

        setContributions(prevContributions => [...prevContributions, ...appliedContributions]);
        return updatedGoals;
      });
    }

    window.addEventListener(PAYMENT_CONFIRMED_EVENT, handlePaymentConfirmed);
    return () => window.removeEventListener(PAYMENT_CONFIRMED_EVENT, handlePaymentConfirmed);
  }, [publicKey]);

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
      <QuickActions onSplitBill={() => setSplitModalOpen(true)} />

      {/* Bill Splits */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Split Bills</h2>
          <button
            onClick={() => setSplitModalOpen(true)}
            aria-label="Split a bill"
            className="px-4 py-2 bg-[#e8b84b] text-black rounded-lg hover:bg-[#e8b84b]/90 transition-colors"
          >
            Split a Bill
          </button>
        </div>
        {splits.length === 0 ? (
          <div className="text-center py-8 text-[#7a8aaa]">
            No split bills yet. Request a group payment and track collection in real time.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {splits.map((split) => (
              <PendingSplitCard
                key={split.id}
                split={split}
                publicKey={publicKey}
                onUpdate={handleSplitUpdated}
              />
            ))}
          </div>
        )}
      </div>

      {/* Savings Goals */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Savings Goals</h2>
          <div className="flex gap-2">
            {goals.some((g) => g.schedule && !g.schedule.paused) && (
              <button
                onClick={handleCheckDueContributions}
                title="Recurring contributions aren't run automatically in the background — check and execute any that are due now."
                className="px-4 py-2 border border-[#e8b84b]/40 text-[#e8b84b] rounded-lg hover:bg-[#e8b84b]/10 transition-colors text-sm"
              >
                Check Due Contributions
              </button>
            )}
            <button
              onClick={() => setGoalModalOpen(true)}
              className="px-4 py-2 bg-[#e8b84b] text-black rounded-lg hover:bg-[#e8b84b]/90 transition-colors"
            >
              Create Goal
            </button>
          </div>
        </div>
        {goals.length === 0 ? (
          <div className="text-center py-8 text-[#7a8aaa]">
            No savings goals yet. Create your first goal to start saving!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <ContributionWidget
                key={goal.id}
                goal={goal}
                contributions={contributions}
                onContribute={handleContribute}
                availableBalance={availableBalance}
                onUpdateSchedule={handleUpdateSchedule}
                onUpdateRoundUpRule={handleUpdateRoundUpRule}
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

      {splitModalOpen && (
        <SplitBillModal
          publicKey={publicKey}
          onClose={() => setSplitModalOpen(false)}
          onCreated={handleSplitCreated}
        />
      )}
    </div>
  );
}
