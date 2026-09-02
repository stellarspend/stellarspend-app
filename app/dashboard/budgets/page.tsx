"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  fetchSharedBudgets,
  createSharedBudget,
  proposeBudgetChange,
  approveBudgetChange,
  rejectBudgetChange,
  fetchPendingChanges,
  subscribeToSharedBudgets,
  getConnectedPublicKey,
  Budget,
  SharedBudget,
  PendingBudgetChange,
} from "@/lib/api/client";
import BudgetForm, { BudgetFormMode } from "@/components/budgets/BudgetForm";
import PendingApprovalCard from "@/components/budgets/PendingApprovalCard";
import BudgetCategoryBreakdownChart from "@/components/budgets/BudgetCategoryBreakdownChart";
import { useOffline } from "@/components/offline/OfflineProvider";
import { useToast } from "@/components/ui/use-toast";

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

function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

export default function BudgetsPage() {
    const { isOnline, queueAction } = useOffline();
    const { toast } = useToast();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [sharedBudgets, setSharedBudgets] = useState<SharedBudget[]>([]);
    const [pendingChanges, setPendingChanges] = useState<PendingBudgetChange[]>([]);
    const [currentUser, setCurrentUser] = useState<string | null>(() => getConnectedPublicKey());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [formMode, setFormMode] = useState<BudgetFormMode>('create');

    const loadAll = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const [owned, shared, changes] = await Promise.all([
                fetchBudgets(),
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
        } finally {
            if (showLoading) setLoading(false);
        }
    }, []);

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
            toast({
                title: "Budget Queued",
                description: "Offline: Your budget has been queued and will be saved when you reconnect.",
            });
            // Optimistic update
            const tempBudget: Budget = {
                ...budgetData,
                id: `temp_${Date.now()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setBudgets(prev => [...prev, tempBudget]);
            setShowForm(false);
            return;
        }

        try {
            if (budgetData.isShared) {
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
            } else {
                const newBudget = await createBudget(budgetData);
                setBudgets(prev => [...prev, newBudget]);
            }
            setShowForm(false);
            toast({
                title: "Budget Created",
                description: `Budget "${budgetData.name}" has been created successfully.`,
            });
        } catch (err) {
            setError('Failed to create budget');
            console.error('Error creating budget:', err);
            toast({
                title: "Failed to Create Budget",
                description: "An error occurred while creating the budget.",
                variant: "destructive",
            });
        }
    };

    const handleUpdateBudget = async (budgetData: BudgetFormData) => {
        if (!editingBudget) return;
        
        if (!isOnline) {
            queueAction('UPDATE_BUDGET', `Update budget: ${budgetData.name}`, { id: editingBudget.id, ...budgetData });
            toast({
                title: "Budget Update Queued",
                description: "Offline: Your budget updates have been queued and will be saved when you reconnect.",
            });
            // Optimistic update
            setBudgets(prev => prev.map(b => b.id === editingBudget.id ? { ...b, ...budgetData } : b));
            setEditingBudget(null);
            setShowForm(false);
            return;
        }

        try {
            const updatedBudget = await updateBudget(editingBudget.id, budgetData);
            setBudgets(prev => prev.map(b => b.id === editingBudget.id ? updatedBudget : b));
            setEditingBudget(null);
            setShowForm(false);
            toast({
                title: "Budget Updated",
                description: `Budget "${budgetData.name}" has been updated successfully.`,
            });
        } catch (err) {
            setError('Failed to update budget');
            console.error('Error updating budget:', err);
            toast({
                title: "Failed to Update Budget",
                description: "An error occurred while updating the budget.",
                variant: "destructive",
            });
        }
    };

    const handleDeleteBudget = async (id: string) => {
        if (!confirm('Are you sure you want to delete this budget?')) return;
        
        if (!isOnline) {
            queueAction('DELETE_BUDGET', `Delete budget: ${id}`, { id });
            toast({
                title: "Budget Deletion Queued",
                description: "Offline: Your deletion request has been queued and will be processed when you reconnect.",
            });
            setBudgets(prev => prev.filter(b => b.id !== id));
            return;
        }

        try {
            await deleteBudget(id);
            setBudgets(prev => prev.filter(b => b.id !== id));
            toast({
                title: "Budget Deleted",
                description: "Budget has been deleted successfully.",
            });
        } catch (err) {
            setError('Failed to delete budget');
            console.error('Error deleting budget:', err);
            toast({
                title: "Failed to Delete Budget",
                description: "An error occurred while deleting the budget.",
                variant: "destructive",
            });
        }
    };

    const handleProposeChange = async (budgetData: BudgetFormData) => {
        if (!editingBudget) return;

        if (!isOnline) {
            queueAction('PROPOSE_BUDGET_CHANGE', `Propose change: ${budgetData.name}`, { id: editingBudget.id, ...budgetData });
            alert('You are offline. Your proposed change has been queued.');
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

    const handleSubmit = (data: BudgetFormData) => {
        if (formMode === 'propose') {
            handleProposeChange(data);
        } else if (editingBudget) {
            handleUpdateBudget(data);
        } else {
            handleCreateBudget(data);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Loading budgets...</div>
            </div>
        );
    }

    const pendingForBudget = (budgetId: string) =>
        pendingChanges.filter((c) => c.budgetId === budgetId && c.status === 'pending');

    return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Budgets
        </h1>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Create Budget
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {formMode === 'propose'
                ? `Propose change to "${editingBudget?.name}"`
                : editingBudget
                  ? "Edit Budget"
                  : "Create New Budget"}
            </h2>
            <button
              onClick={handleCancelForm}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          <BudgetForm
            onSubmit={handleSubmit}
            onCancel={handleCancelForm}
            initialData={editingBudget}
            isEditing={formMode !== 'create'}
            mode={formMode}
            budgetCount={budgets.length}
          />
        </div>
      )}

      <section className="mb-10" aria-label="Your budgets">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Your Budgets
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {budget.name}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditBudget(budget)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBudget(budget.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Amount:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {budget.amount} {budget.asset}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Category:
                  </span>
                  <span className="capitalize text-gray-900 dark:text-white">
                    {budget.category}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Period:
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(budget.startDate).toLocaleDateString()} -{" "}
                    {new Date(budget.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {budgets.length > 0 && (
          <BudgetCategoryBreakdownChart budgets={budgets} />
        )}

        {budgets.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-gray-500 mb-4">No owned budgets found</div>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Create your first budget
            </button>
          </div>
        )}
      </section>

      <section aria-label="Shared budgets">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
          Shared Budgets
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Budgets co-owned with others — changes require co-owner approval before taking effect.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sharedBudgets.map((budget) => {
            const pendingCount = pendingForBudget(budget.id).length;
            const memberCount = budget.coOwners.length + 1;
            return (
              <div
                key={budget.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-amber-200 dark:border-amber-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {budget.name}
                  </h3>
                  <button
                    onClick={() => handleProposeBudget(budget)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Propose Change
                  </button>
                </div>

                <span className="inline-flex items-center px-2 py-0.5 mb-3 text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
                  {budget.approvalThreshold} of {memberCount} approval
                </span>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Amount:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {budget.amount} {budget.asset}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Category:
                    </span>
                    <span className="capitalize text-gray-900 dark:text-white">
                      {budget.category}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Period:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(budget.startDate).toLocaleDateString()} -{" "}
                      {new Date(budget.endDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400 text-sm block mb-1">
                      Members:
                    </span>
                    <ul className="flex flex-wrap gap-1.5">
                      {[budget.ownerAddress, ...budget.coOwners].map((address) => (
                        <li
                          key={address}
                          className={`px-2 py-0.5 text-xs rounded-full font-mono ${
                            address === currentUser
                              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
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
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {pendingCount} change{pendingCount === 1 ? "" : "s"} awaiting approval
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sharedBudgets.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-gray-500 mb-4">
              No shared budgets yet
            </div>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Create a shared budget
            </button>
          </div>
        )}
      </section>

      {pendingChanges.length > 0 && (
        <section className="mt-10" aria-label="Pending approvals">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Pending Approvals
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
