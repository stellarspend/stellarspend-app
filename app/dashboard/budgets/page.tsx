"use client";

import { useState, useEffect } from "react";
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  Budget,
} from "@/lib/api/client";
import BudgetForm from "@/components/budgets/BudgetForm";

interface BudgetFormData {
  name: string;
  amount: number;
  category: string;
  asset: 'XLM' | 'USDC' | 'EURC';
  startDate: string;
  endDate: string;
}

const CATEGORY_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-cyan-500",
];

function formatCategory(category: string) {
    return category
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

    useEffect(() => {
        loadBudgets();
    }, []);

    const loadBudgets = async () => {
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
    };

    const handleCreateBudget = async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            const newBudget = await createBudget(budgetData);
            setBudgets(prev => [...prev, newBudget]);
            setShowForm(false);
        } catch (err) {
            setError('Failed to create budget');
            console.error('Error creating budget:', err);
        }
    };

    const handleUpdateBudget = async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!editingBudget) return;
        
        try {
            const updatedBudget = await updateBudget(editingBudget.id, budgetData);
            setBudgets(prev => prev.map(b => b.id === editingBudget.id ? updatedBudget : b));
            setEditingBudget(null);
            setShowForm(false);
        } catch (err) {
            setError('Failed to update budget');
            console.error('Error updating budget:', err);
        }
    };

    const handleDeleteBudget = async (id: string) => {
        if (!confirm('Are you sure you want to delete this budget?')) return;
        
        try {
            await deleteBudget(id);
            setBudgets(prev => prev.filter(b => b.id !== id));
        } catch (err) {
            setError('Failed to delete budget');
            console.error('Error deleting budget:', err);
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

    const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const categoryBreakdown = Object.values(
        budgets.reduce<Record<string, { category: string; total: number; count: number }>>(
            (acc, budget) => {
                const category = budget.category || "uncategorized";
                if (!acc[category]) {
                    acc[category] = { category, total: 0, count: 0 };
                }

                acc[category].total += budget.amount;
                acc[category].count += 1;
                return acc;
            },
            {},
        ),
    ).sort((a, b) => b.total - a.total);

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
          />
        </div>
      )}

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Category Breakdown
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Spending allocation across your current budgets.
            </p>
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total: {totalBudget.toFixed(2)}
          </div>
        </div>

        {categoryBreakdown.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              {categoryBreakdown.map((item, index) => {
                const percentage =
                  totalBudget > 0 ? Math.round((item.total / totalBudget) * 100) : 0;
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                return (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`h-3 w-3 flex-none rounded-full ${color}`} />
                        <span className="truncate font-medium text-gray-900 dark:text-white">
                          {formatCategory(item.category)}
                        </span>
                      </div>
                      <div className="flex flex-none items-center gap-3 text-gray-600 dark:text-gray-400">
                        <span>{item.total.toFixed(2)}</span>
                        <span className="w-10 text-right font-semibold text-gray-900 dark:text-white">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    <div
                      className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
                      aria-label={`${formatCategory(item.category)} ${percentage}%`}
                    >
                      <div
                        className={`h-full rounded-full ${color} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Summary
              </h3>
              <dl className="space-y-3">
                {categoryBreakdown.slice(0, 4).map((item, index) => {
                  const percentage =
                    totalBudget > 0 ? Math.round((item.total / totalBudget) * 100) : 0;

                  return (
                    <div key={item.category} className="flex items-center justify-between gap-3">
                      <dt className="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span
                          className={`h-2.5 w-2.5 flex-none rounded-full ${
                            CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                          }`}
                        />
                        <span className="truncate">{formatCategory(item.category)}</span>
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                        {percentage}%
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Create a budget to see spending by category.
          </div>
        )}
      </section>

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
