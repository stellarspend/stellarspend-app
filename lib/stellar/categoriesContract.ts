/**
 * lib/stellar/categoriesContract.ts
 *
 * Client for the on-chain spending-categories Soroban contract, used to tag
 * transactions with a spending category (e.g. "Groceries") so the analytics
 * contract's category breakdown (see lib/api/stellar/analyticsContract.ts)
 * has real data to aggregate.
 *
 * Follows the same read/write split used by lib/stellar/budgetContract.ts and
 * lib/stellar/savingsGoalContract.ts: `callContractView` for simulated reads,
 * `submitContractTx` for signed/submitted writes. When
 * NEXT_PUBLIC_CATEGORIES_CONTRACT_ID isn't configured (e.g. local dev before
 * the contract is deployed), categories are persisted to localStorage so the
 * UI still works end-to-end.
 */

import { callContractView, submitContractTx, triggerNotification } from './budgetContract';

const CATEGORIES_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CATEGORIES_CONTRACT_ID ?? '';

const LOCAL_CATEGORIES_KEY = 'stellarspend_local_categories';

/** Standard categories offered in the picker; users may also enter a custom label. */
export const STANDARD_CATEGORIES = [
  'Groceries',
  'Transport',
  'Utilities',
  'Healthcare',
  'Education',
  'Savings',
  'Other',
] as const;

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

/** Deterministic badge color per category, keyed by lowercase label so custom
 * categories that happen to match a standard name (any casing) still get a
 * themed color; anything else falls back to CATEGORY_COLORS.default. */
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  groceries: { bg: 'bg-[#4ade80]/10', text: 'text-[#4ade80]', border: 'border-[#4ade80]/20' },
  transport: { bg: 'bg-[#4aa9e8]/10', text: 'text-[#4aa9e8]', border: 'border-[#4aa9e8]/20' },
  utilities: { bg: 'bg-[#e8b84b]/10', text: 'text-[#e8b84b]', border: 'border-[#e8b84b]/20' },
  healthcare: { bg: 'bg-[#f87171]/10', text: 'text-[#f87171]', border: 'border-[#f87171]/20' },
  education: { bg: 'bg-[#c084fc]/10', text: 'text-[#c084fc]', border: 'border-[#c084fc]/20' },
  savings: { bg: 'bg-[#2dd4bf]/10', text: 'text-[#2dd4bf]', border: 'border-[#2dd4bf]/20' },
  other: { bg: 'bg-white/10', text: 'text-white/70', border: 'border-white/20' },
  default: { bg: 'bg-[#f97316]/10', text: 'text-[#f97316]', border: 'border-[#f97316]/20' },
};

export function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.default;
}

// ---------------------------------------------------------------------------
// localStorage fallback (used when the contract isn't deployed yet)
// ---------------------------------------------------------------------------

function getLocalCategories(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as Record<string, string>;
  } catch (e) {
    console.error('Failed to parse locally stored categories', e);
    return {};
  }
}

function setLocalCategory(transactionId: string, category: string) {
  if (typeof window === 'undefined') return;
  const all = getLocalCategories();
  all[transactionId] = category;
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(all));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetches the category currently assigned to a transaction, or null if unset. */
export async function getCategory(
  publicKey: string,
  transactionId: string,
): Promise<string | null> {
  if (!CATEGORIES_CONTRACT_ID) {
    return getLocalCategories()[transactionId] ?? null;
  }
  try {
    const result = await callContractView<string | null>(
      publicKey,
      CATEGORIES_CONTRACT_ID,
      'get_category',
      [transactionId],
    );
    return result || null;
  } catch (e) {
    console.error(`Failed to fetch category for ${transactionId}. Falling back to local storage.`, e);
    return getLocalCategories()[transactionId] ?? null;
  }
}

/** Fetches categories for multiple transactions at once (used to render list badges). */
export async function getCategoriesForTransactions(
  publicKey: string,
  transactionIds: string[],
): Promise<Record<string, string>> {
  if (!CATEGORIES_CONTRACT_ID) {
    const local = getLocalCategories();
    const result: Record<string, string> = {};
    for (const id of transactionIds) {
      if (local[id]) result[id] = local[id];
    }
    return result;
  }

  const entries = await Promise.all(
    transactionIds.map(async (id) => {
      try {
        const category = await getCategory(publicKey, id);
        return [id, category] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );

  return entries.reduce<Record<string, string>>((acc, [id, category]) => {
    if (category) acc[id] = category;
    return acc;
  }, {});
}

/** Assigns (or reassigns) a spending category to a transaction. */
export async function setCategory(
  publicKey: string,
  transactionId: string,
  category: string,
): Promise<void> {
  if (!CATEGORIES_CONTRACT_ID) {
    setLocalCategory(transactionId, category);
    return;
  }
  try {
    await submitContractTx(
      publicKey,
      CATEGORIES_CONTRACT_ID,
      'set_category',
      [transactionId, category],
    );
    setLocalCategory(transactionId, category);
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to set category: ${errMessage}`);
    throw e;
  }
}
