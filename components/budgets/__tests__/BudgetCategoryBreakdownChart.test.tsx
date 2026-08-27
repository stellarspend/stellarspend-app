import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BudgetCategoryBreakdownChart from "../BudgetCategoryBreakdownChart";
import { Budget } from "@/lib/api/client";

// Mock recharts ResponsiveContainer to avoid size rendering issues in JSDOM
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: "100%", height: 300 }}>{children}</div>
    ),
  };
});

describe("BudgetCategoryBreakdownChart", () => {
  const mockBudgets: Budget[] = [
    {
      id: "b1",
      name: "Groceries",
      amount: 250,
      category: "food",
      asset: "XLM",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
    {
      id: "b2",
      name: "Dining Out",
      amount: 150,
      category: "food",
      asset: "XLM",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
    {
      id: "b3",
      name: "Gas & Metro",
      amount: 100,
      category: "transport",
      asset: "XLM",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
    {
      id: "b4",
      name: "Rent USD",
      amount: 1000,
      category: "housing",
      asset: "USDC",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
  ];

  it("renders empty state placeholder when no budgets are present", () => {
    render(<BudgetCategoryBreakdownChart budgets={[]} />);
    expect(screen.getByText(/Category Spending Breakdown/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Create budgets to see your spending allocation/i)
    ).toBeInTheDocument();
  });

  it("renders chart correctly and aggregates categories for selected asset", () => {
    render(<BudgetCategoryBreakdownChart budgets={mockBudgets} />);
    expect(screen.getByTestId("budget-category-breakdown-chart")).toBeInTheDocument();
    expect(screen.getByText(/Category Spending Breakdown/i)).toBeInTheDocument();
    // Food (250 + 150 = 400) + Transport (100) = 500 XLM across 3 XLM budgets
    expect(screen.getByText(/500.00 XLM/i)).toBeInTheDocument();
    expect(screen.getByText(/across 3 budgets/i)).toBeInTheDocument();
  });

  it("allows switching between Pie Chart and Bar Chart views", () => {
    render(<BudgetCategoryBreakdownChart budgets={mockBudgets} />);
    const barBtn = screen.getByRole("button", { name: /Bar chart view/i });
    fireEvent.click(barBtn);
    expect(barBtn.className).toContain("bg-white");

    const pieBtn = screen.getByRole("button", { name: /Pie chart view/i });
    fireEvent.click(pieBtn);
    expect(pieBtn.className).toContain("bg-white");
  });

  it("allows switching between different assets", () => {
    render(<BudgetCategoryBreakdownChart budgets={mockBudgets} />);
    const usdcBtn = screen.getByRole("button", { name: "USDC" });
    fireEvent.click(usdcBtn);
    expect(screen.getByText(/1,000.00 USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/across 1 budget/i)).toBeInTheDocument();
  });
});
