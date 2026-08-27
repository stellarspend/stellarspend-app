"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  Budget,
} from "@/lib/api/client";
import BudgetForm from "@/components/budgets/BudgetForm";
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
}

export default function BudgetsPage() {
    const { isOnline, queueAction } = useOffline();
    const { toast } = useToast();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

    const loadBudgets = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchBudgets();
            setBudgets(data);
            setError(null);
        } catch (err) {
            setError('Failed to load budgets');
            console.error('Error loading budgets:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadBudgets();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadBudgets]);

    const handleCreateBudget = async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
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
            const newBudget = await createBudget(budgetData);
            setBudgets(prev => [...prev, newBudget]);
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

    const handleUpdateBudget = async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
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

    const handleEditBudget = (budget: Budget) => {
        setEditingBudget(budget);
        setShowForm(true);
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingBudget(null);
    };

    const handleSubmit = (data: BudgetFormData) => {
        if (editingBudget) {
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

    return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Budgets
        </h1>
        <button
          onClick={() => setShowForm(true)}
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
              {editingBudget ? "Edit Budget" : "Create New Budget"}
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
            isEditing={!!editingBudget}
            budgetCount={budgets.length}
          />
        </div>
      )}

      {budgets.length > 0 && (
        <BudgetCategoryBreakdownChart budgets={budgets} />
      )}

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

      {budgets.length === 0 && !showForm && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No budgets found</div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Create your first budget
          </button>
        </div>
      )}
    </div>
  );
}
