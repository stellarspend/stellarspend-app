"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart,
  Plus,
  RefreshCw,
  Coins,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  fetchBudgets as fetchOnChainBudgets,
  createBudget as createOnChainBudget,
  updateBudget as updateOnChainBudget,
  deleteBudget as deleteOnChainBudget,
  getMockBudgetsFallback,
} from "@/lib/stellar/budgetContract";
import {
  fetchSharedBudgets,
  createSharedBudget,
  proposeBudgetChange,
  approveBudgetChange,
  rejectBudgetChange,
  fetchPendingChanges,
  subscribeToSharedBudgets,
  getConnectedPublicKey,
} from "@/lib/api/client";
import type {
  Budget,
  SharedBudget,
  PendingBudgetChange,
} from "@/lib/api/client";
import BudgetForm, { BudgetFormMode } from "@/components/budgets/BudgetForm";
import BudgetCard from "@/components/budgets/BudgetCard";
import PendingApprovalCard from "@/components/budgets/PendingApprovalCard";
import BudgetCategoryBreakdownChart from "@/components/budgets/BudgetCategoryBreakdownChart";
import { useOffline } from "@/components/offline/OfflineProvider";
import { useNotifications } from "@/context/NotificationContext";
import useWallet from "@/hooks/useWallet";

interface BudgetFormData {
  name: string;
  amount: number;
  category: string;
  asset: 'XLM' | 'USDC' | 'EURC';
  startDate: string;
  endDate: string;
  isShared?: boolean;
  coOwners?: string[];
  approvalThreshold?: number;
}

/**
 * Per-budget "spent" figures come from the spending-limits / payments
 * attribution pipeline, which is not yet wired to the budget contract
 * (see #124 — cross-chain budget ↔ spending-limits linkage is out of scope).
 * Defaults to 0 so progress bars render until that data source is connected.
 */
const SPENT_BY_BUDGET: Record<string, number> = {};

function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function formatAmount(val: number): string {
  return val % 1 === 0 ? val.toString() : val.toFixed(2);
}

function toOwnedBudgetData(data: BudgetFormData): Omit<Budget, "id" | "createdAt" | "updatedAt"> {
  return {
    name: data.name,
    amount: data.amount,
    category: data.category,
    asset: data.asset,
    startDate: data.startDate,
    endDate: data.endDate,
  };
}

export default function BudgetsPage() {
  const { freighter } = useWallet();
  const publicKey = freighter.publicKey;
  const { isOnline, queueAction } = useOffline();
  const { addNotification } = useNotifications();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [sharedBudgets, setSharedBudgets] = useState<SharedBudget[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingBudgetChange[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(() => getConnectedPublicKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formMode, setFormMode] = useState<BudgetFormMode>('create');
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const loadAll = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [owned, shared, changes] = await Promise.all([
        publicKey ? fetchOnChainBudgets(publicKey) : Promise.resolve(getMockBudgetsFallback()),
        fetchSharedBudgets(),
        fetchPendingChanges(),
      ]);
      setBudgets(owned.filter((b) => !b.isShared));
      setSharedBudgets(shared);
      setPendingChanges(changes);
      setError(null);
    } catch (err) {
      setError('Failed to load budgets');
      console.error('Error loading budgets:', err);
      addNotification('error', 'Failed to load budgets.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [publicKey, addNotification]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAll]);

  // Real-time updates across co-owner sessions: refresh shared budgets and
  // pending changes whenever another session proposes, approves, or rejects.
  useEffect(() => {
    const handleWalletChange = (event: StorageEvent) => {
      if (
        event.key === 'stellarspend_selected_wallet' ||
        event.key === 'stellarspend_wallets' ||
        event.key === null
      ) {
        setCurrentUser(getConnectedPublicKey());
        void loadAll(false);
      }
    };
    window.addEventListener('storage', handleWalletChange);
    const unsubscribe = subscribeToSharedBudgets(() => {
      void loadAll(false);
    });
    return () => {
      window.removeEventListener('storage', handleWalletChange);
      unsubscribe();
    };
  }, [loadAll]);

  const handleCreateBudget = async (budgetData: BudgetFormData) => {
    if (!isOnline) {
      queueAction('CREATE_BUDGET', `Create budget: ${budgetData.name}`, budgetData);
      addNotification(
        'success',
        `Offline: Budget "${budgetData.name}" has been queued and will be saved when you reconnect.`
      );
      if (!budgetData.isShared) {
        const tempBudget: Budget = {
          ...toOwnedBudgetData(budgetData),
          id: `temp_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setBudgets(prev => [...prev, tempBudget]);
      }
      setShowForm(false);
      return;
    }

    if (budgetData.isShared) {
      try {
        const newBudget = await createSharedBudget({
          name: budgetData.name,
          amount: budgetData.amount,
          category: budgetData.category,
          asset: budgetData.asset,
          startDate: budgetData.startDate,
          endDate: budgetData.endDate,
          coOwners: budgetData.coOwners ?? [],
          approvalThreshold: budgetData.approvalThreshold ?? 2,
        });
        setSharedBudgets(prev => [...prev, newBudget]);
        await loadAll(false);
        setShowForm(false);
        addNotification('success', `Shared budget "${budgetData.name}" created successfully.`);
      } catch (err) {
        setError('Failed to create shared budget');
        console.error('Error creating shared budget:', err);
        addNotification('error', 'Failed to create shared budget.');
      }
      return;
    }

    if (!publicKey) {
      addNotification('error', 'Connect your wallet to persist this budget on-chain.');
      return;
    }

    try {
      setTxStatus('Initializing transaction...');
      const newBudget = await createOnChainBudget(
        publicKey,
        toOwnedBudgetData(budgetData),
        (status) => setTxStatus(status)
      );
      setBudgets(prev => [...prev, newBudget]);
      setShowForm(false);
      addNotification('success', `Budget "${budgetData.name}" created successfully.`);
    } catch (err) {
      setError('Failed to create budget');
      console.error('Error creating budget:', err);
      addNotification('error', `Failed to create budget "${budgetData.name}".`);
    } finally {
      setTxStatus(null);
    }
  };

  const handleUpdateBudget = async (budgetData: BudgetFormData) => {
    if (!editingBudget) return;

    if (!isOnline) {
      queueAction('UPDATE_BUDGET', `Update budget: ${budgetData.name}`, { id: editingBudget.id, ...budgetData });
      addNotification('success', 'Offline: Your budget update has been queued.');
      setBudgets(prev => prev.map(b => b.id === editingBudget.id ? { ...b, ...budgetData } : b));
      setEditingBudget(null);
      setShowForm(false);
      return;
    }

    if (!publicKey) {
      addNotification('error', 'Connect your wallet to update this budget.');
      return;
    }

    try {
      const updatedBudget = await updateOnChainBudget(
        publicKey,
        editingBudget.id,
        toOwnedBudgetData(budgetData)
      );
      setBudgets(prev => prev.map(b => b.id === editingBudget.id ? updatedBudget : b));
      setEditingBudget(null);
      setShowForm(false);
      addNotification('success', `Budget "${budgetData.name}" updated successfully.`);
    } catch (err) {
      setError('Failed to update budget');
      console.error('Error updating budget:', err);
      addNotification('error', `Failed to update budget "${budgetData.name}".`);
    }
  };

  const handleUpdateBudgetAmount = async (id: string, amount: number) => {
    const target = budgets.find((b) => b.id === id);
    if (!target) return;

    if (!isOnline) {
      queueAction('UPDATE_BUDGET', `Update budget: ${target.name}`, { id, amount });
      addNotification('success', `Offline: Budget update for "${target.name}" queued.`);
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, amount } : b));
      return;
    }

    if (!publicKey) {
      addNotification('error', 'Connect your wallet to update this budget.');
      return;
    }

    try {
      const updatedBudget = await updateOnChainBudget(publicKey, id, {
        name: target.name,
        amount,
        category: target.category,
        asset: target.asset,
        startDate: target.startDate,
        endDate: target.endDate,
      });
      setBudgets(prev => prev.map(b => b.id === id ? updatedBudget : b));
      addNotification('success', `Updated "${target.name}" to ${formatAmount(amount)} ${target.asset} / month.`);
    } catch (err) {
      console.error('Error updating budget amount:', err);
      addNotification('error', `Failed to update "${target.name}".`);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    if (!isOnline) {
      queueAction('DELETE_BUDGET', `Delete budget: ${budget.id}`, { id: budget.id });
      addNotification('success', `Offline: Deletion of "${budget.name}" queued.`);
      setBudgets(prev => prev.filter(b => b.id !== budget.id));
      return;
    }

    if (!publicKey) {
      addNotification('error', 'Connect your wallet to delete this budget.');
      return;
    }

    try {
      await deleteOnChainBudget(publicKey, budget.id);
      setBudgets(prev => prev.filter(b => b.id !== budget.id));
      addNotification('success', `Budget "${budget.name}" deleted successfully.`);
    } catch (err) {
      setError('Failed to delete budget');
      console.error('Error deleting budget:', err);
      addNotification('error', `Failed to delete budget "${budget.name}".`);
    }
  };

  const handleProposeChange = async (budgetData: BudgetFormData) => {
    if (!editingBudget) return;

    if (!isOnline) {
      queueAction('PROPOSE_BUDGET_CHANGE', `Propose change: ${budgetData.name}`, { id: editingBudget.id, ...budgetData });
      addNotification('success', 'Offline: Your proposed change has been queued.');
      setEditingBudget(null);
      setShowForm(false);
      return;
    }

    try {
      const changes = {
        name: budgetData.name,
        amount: budgetData.amount,
        category: budgetData.category,
        asset: budgetData.asset,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
      };
      await proposeBudgetChange(editingBudget.id, changes);
      await loadAll(false);
      setEditingBudget(null);
      setShowForm(false);
    } catch (err) {
      setError('Failed to propose change');
      console.error('Error proposing change:', err);
    }
  };

  const handleApproveChange = async (changeId: string) => {
    try {
      await approveBudgetChange(changeId);
      await loadAll(false);
    } catch (err) {
      setError('Failed to approve change');
      console.error('Error approving change:', err);
    }
  };

  const handleRejectChange = async (changeId: string) => {
    try {
      await rejectBudgetChange(changeId);
      await loadAll(false);
    } catch (err) {
      setError('Failed to reject change');
      console.error('Error rejecting change:', err);
    }
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setFormMode('edit');
    setShowForm(true);
  };

  const handleProposeBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setFormMode('propose');
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingBudget(null);
    setFormMode('create');
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  const handleRefresh = () => {
    void loadAll();
  };

  const handleSubmit = (data: BudgetFormData) => {
    if (formMode === 'propose') {
      handleProposeChange(data);
    } else if (editingBudget) {
      handleUpdateBudget(data);
    } else {
      handleCreateBudget(data);
    }
  };

  const pendingForBudget = (budgetId: string) =>
    pendingChanges.filter((c) => c.budgetId === budgetId && c.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full border border-[#e8b84b]/20 bg-[#e8b84b]/[0.08] text-[#e8b84b]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#e8b84b] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
              Monthly Spending Controls
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Budget <span className="text-[#e8b84b]">Planner</span>
          </h1>
          <p className="text-[#7a8aaa] mt-1 text-sm max-w-lg leading-relaxed">
            Track on-chain spending limits per category and keep every transaction within your monthly plan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-3.5 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.08] hover:border-white/20 text-[#7a8aaa] hover:text-white transition-all active:scale-95 disabled:opacity-50"
            title="Refresh budgets"
            aria-label="Refresh budgets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e8b84b]" : ""}`} />
          </button>

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-5 py-3.5 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-2xl shadow-xl shadow-[#e8b84b]/10 transition-all hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Budget</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Budget Form (create / edit / propose) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl bg-[#0c1020]/90 border border-white/10 p-6 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white tracking-tight">
                {formMode === 'propose'
                  ? `Propose change to "${editingBudget?.name}"`
                  : editingBudget
                    ? "Edit Budget"
                    : "Create New Budget"}
              </h2>
              <div className="flex items-center gap-3">
                {txStatus && (
                  <span className="text-xs text-[#e8b84b] flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {txStatus}
                  </span>
                )}
                <button
                  onClick={handleCancelForm}
                  className="p-2 rounded-xl text-[#7a8aaa] hover:text-white hover:bg-white/5 border border-white/10 transition-all"
                  aria-label="Cancel form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <BudgetForm
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              initialData={editingBudget}
              isEditing={formMode !== 'create'}
              mode={formMode}
              budgetCount={budgets.length}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Owned Budgets */}
      <section aria-label="Your budgets">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#e8b84b]" />
            <p className="text-sm font-medium text-[#7a8aaa]">Loading budgets...</p>
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
            <div className="w-16 h-16 rounded-3xl bg-[#e8b84b]/10 border border-[#e8b84b]/20 flex items-center justify-center mx-auto mb-4">
              <PieChart className="w-8 h-8 text-[#e8b84b]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">No budgets set</h3>
            <p className="text-sm text-[#7a8aaa] max-w-sm mx-auto mb-6">
              Create a monthly budget per category to keep your spending on track.
            </p>
            <button
              onClick={handleCreateNew}
              className="px-6 py-3 bg-[#e8b84b] hover:bg-[#f0c85a] text-[#1a0f00] font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#e8b84b]/10 transition-all hover:-translate-y-0.5"
            >
              Create Your First Budget
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {budgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    spent={SPENT_BY_BUDGET[budget.id] ?? 0}
                    onSaveEdit={handleUpdateBudgetAmount}
                    onDelete={handleDeleteBudget}
                  />
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-10">
              <BudgetCategoryBreakdownChart budgets={budgets} />
            </div>
          </>
        )}
      </section>

      {/* Shared Budgets */}
      <section aria-label="Shared budgets">
        <div className="mb-4">
          <h2 className="text-2xl font-black text-white tracking-tight">
            Shared <span className="text-[#e8b84b]">Budgets</span>
          </h2>
          <p className="text-sm text-[#7a8aaa] mt-1">
            Budgets co-owned with others — changes require co-owner approval before taking effect.
          </p>
        </div>

        {sharedBudgets.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
            <div className="w-14 h-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
              <Coins className="w-6 h-6 text-[#7a8aaa]" />
            </div>
            <p className="text-[#7a8aaa] text-sm mb-4">No shared budgets yet</p>
            <button
              onClick={handleCreateNew}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
            >
              Create a shared budget
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sharedBudgets.map((budget) => {
              const pendingCount = pendingForBudget(budget.id).length;
              const memberCount = budget.coOwners.length + 1;
              return (
                <div
                  key={budget.id}
                  className="relative rounded-3xl bg-[#0c1020]/90 border border-[#e8b84b]/20 p-6 backdrop-blur-xl shadow-xl hover:border-[#e8b84b]/40 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-black text-white tracking-tight capitalize">
                      {budget.name}
                    </h3>
                    <button
                      onClick={() => handleProposeBudget(budget)}
                      className="text-xs font-bold text-[#e8b84b] hover:text-[#f0c85a] transition-colors px-2 py-1 rounded-lg border border-[#e8b84b]/20 hover:border-[#e8b84b]/40"
                    >
                      Propose Change
                    </button>
                  </div>

                  <span className="inline-flex items-center px-2 py-0.5 mb-3 text-xs font-semibold bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                    {budget.approvalThreshold} of {memberCount} approval required
                  </span>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#7a8aaa]">Amount:</span>
                      <span className="font-bold text-white">
                        {formatAmount(budget.amount)} {budget.asset}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7a8aaa]">Category:</span>
                      <span className="capitalize text-white">{budget.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7a8aaa]">Period:</span>
                      <span className="text-white">
                        {new Date(budget.startDate).toLocaleDateString()} -{" "}
                        {new Date(budget.endDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <span className="text-[#7a8aaa] text-xs block mb-1.5">
                        Members:
                      </span>
                      <ul className="flex flex-wrap gap-1.5">
                        {[budget.ownerAddress, ...budget.coOwners].map((address) => (
                          <li
                            key={address}
                            className={`px-2 py-0.5 text-xs rounded-full font-mono border ${
                              address === currentUser
                                ? "bg-[#e8b84b]/10 border-[#e8b84b]/20 text-[#e8b84b]"
                                : "bg-white/5 border-white/10 text-[#7a8aaa]"
                            }`}
                            title={address}
                          >
                            {shortAddress(address)}
                            {address === currentUser ? " (you)" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {pendingCount > 0 && (
                      <p className="text-xs text-amber-400 font-semibold">
                        {pendingCount} change{pendingCount === 1 ? "" : "s"} awaiting approval
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending Approvals */}
      {pendingChanges.length > 0 && (
        <section aria-label="Pending approvals">
          <h2 className="text-2xl font-black text-white tracking-tight mb-4">
            Pending <span className="text-[#e8b84b]">Approvals</span>
          </h2>
          <div className="space-y-4">
            {pendingChanges.map((change) => {
              const budget = sharedBudgets.find((b) => b.id === change.budgetId);
              if (!budget) return null;
              return (
                <PendingApprovalCard
                  key={change.id}
                  change={change}
                  budget={budget}
                  currentUser={currentUser}
                  onApprove={handleApproveChange}
                  onReject={handleRejectChange}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}