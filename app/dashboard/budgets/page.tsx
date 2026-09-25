import type { Metadata } from "next";
import BudgetsPageClient from "@/components/budgets/BudgetsPageClient";

export const metadata: Metadata = { title: "Budgets | StellarSpend" };

export default function BudgetsPage() {
  return <BudgetsPageClient />;
}
