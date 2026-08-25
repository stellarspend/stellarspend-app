/**
 * Shared spending categories used across the app.
 *
 * Each entry maps a machine-readable id to a human-readable label and
 * a colour token for the UI badge.
 */

export interface CategoryDef {
  id: string;
  label: string;
  /** Tailwind colour classes for the badge (background | text | border). */
  badge: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'food',
    label: 'Food & Drinks',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    id: 'transport',
    label: 'Transport',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  {
    id: 'housing',
    label: 'Housing',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  },
  {
    id: 'utilities',
    label: 'Utilities',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as readonly string[];

/** Look up a category definition by id. */
export function getCategoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}