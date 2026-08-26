"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Budget } from "@/lib/api/client";

export interface BudgetCategoryBreakdownChartProps {
  budgets: Budget[];
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "#3b82f6", // blue
  groceries: "#3b82f6",
  transport: "#10b981", // green
  housing: "#f59e0b", // amber
  utilities: "#8b5cf6", // purple
  entertainment: "#ec4899", // pink
  healthcare: "#ef4444", // red
  shopping: "#06b6d4", // cyan
  education: "#84cc16", // lime
  travel: "#14b8a6", // teal
  savings: "#6366f1", // indigo
  other: "#64748b", // slate
};

const DEFAULT_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#14b8a6",
  "#84cc16",
  "#6366f1",
];

function getCategoryColor(category: string, index: number): string {
  const normalized = category.toLowerCase().trim();
  return CATEGORY_COLORS[normalized] || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}

function formatCategoryLabel(category: string): string {
  if (!category) return "Uncategorized";
  return category
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function BudgetCategoryBreakdownChart({ budgets }: BudgetCategoryBreakdownChartProps) {
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const availableAssets = Array.from(new Set(budgets.map((b) => b.asset || "XLM")));
  const [selectedAsset, setSelectedAsset] = useState<string>(availableAssets[0] || "XLM");

  // Keep selectedAsset valid when budgets change
  const currentAsset = (availableAssets as string[]).includes(selectedAsset)
    ? selectedAsset
    : availableAssets[0] || "XLM";

  const filteredBudgets = budgets.filter((b) => (b.asset || "XLM") === currentAsset);

  // Aggregate budget spending/amounts by category
  const categoryMap = new Map<string, { category: string; label: string; amount: number; count: number }>();

  filteredBudgets.forEach((budget) => {
    const rawCategory = budget.category?.trim() || "other";
    const key = rawCategory.toLowerCase();
    const existing = categoryMap.get(key);
    const amount = Number(budget.amount) || 0;

    if (existing) {
      existing.amount += amount;
      existing.count += 1;
    } else {
      categoryMap.set(key, {
        category: rawCategory,
        label: formatCategoryLabel(rawCategory),
        amount,
        count: 1,
      });
    }
  });

  const chartData = Array.from(categoryMap.values()).map((item, idx) => ({
    ...item,
    amount: Number(item.amount.toFixed(2)),
    color: getCategoryColor(item.category, idx),
  }));

  const totalAmount = chartData.reduce((sum, item) => sum + item.amount, 0);

  if (budgets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Category Spending Breakdown
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create budgets to see your spending allocation by category.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="budget-category-breakdown-chart"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-6 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Category Spending Breakdown
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Budgeted:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              {currentAsset}
            </span>{" "}
            across {filteredBudgets.length} {filteredBudgets.length === 1 ? "budget" : "budgets"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Asset Selector */}
          {availableAssets.length > 1 && (
            <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
              {availableAssets.map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    currentAsset === asset
                      ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          )}

          {/* Chart Type Toggle */}
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button
              type="button"
              onClick={() => setChartType("pie")}
              aria-label="Pie chart view"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "pie"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Pie Chart
            </button>
            <button
              type="button"
              onClick={() => setChartType("bar")}
              aria-label="Bar chart view"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "bar"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Bar Chart
            </button>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">
          No budget data found for {currentAsset}.
        </div>
      ) : (
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "pie" ? (
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  innerRadius="45%"
                  paddingAngle={3}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    percent && percent > 0.05 ? `${name || ""} (${((percent || 0) * 100).toFixed(0)}%)` : ""
                  }
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string | undefined) => [
                    `${Number(value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${currentAsset} (${
                      totalAmount > 0 ? (((Number(value) || 0) / totalAmount) * 100).toFixed(1) : "0"
                    }%)`,
                    "Budget Amount",
                  ]}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 20, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number | string | undefined) => [
                    `${Number(value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${currentAsset}`,
                    "Budget Amount",
                  ]}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="amount"
                  name={`Budget Amount (${currentAsset})`}
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
