/**
 * Calculates the round-up amount for a given transaction amount.
 *
 * Rounds `amount` up to the nearest multiple of `nearestUnit` and returns
 * the difference (the "spare change") as a positive value rounded to 2
 * decimal places.
 *
 * @param amount - The transaction amount. Must be positive to produce a result.
 * @param nearestUnit - The rounding unit (e.g. 1 or 5). Must be greater than 0.
 * @returns The round-up difference in the same currency, rounded to 2 decimals,
 *   or `0` if either `amount` or `nearestUnit` is not positive.
 */
export function calculateRoundUp(amount: number, nearestUnit: number): number {
  if (nearestUnit <= 0 || amount <= 0) return 0;
  const rounded = Math.ceil(amount / nearestUnit) * nearestUnit;
  return Math.round((rounded - amount) * 100) / 100;
}

/**
 * Calculates the round-up contribution for a transaction.
 *
 * Uses {@link calculateRoundUp} to compute the spare-change amount and
 * derives the total charge (original amount plus round-up).
 *
 * @param transactionAmount - The original transaction amount. Must be positive
 *   to produce a result.
 * @param nearestUnit - The rounding unit (e.g. 1 or 5). Must be greater than 0.
 * @returns An object with `roundUpAmount` (the spare change, rounded to 2
 *   decimals) and `roundedTotal` (the transaction amount plus the round-up),
 *   or `null` if no round-up applies (non-positive inputs or a zero difference).
 */
export function calculateRoundUpContribution(
  transactionAmount: number,
  nearestUnit: number,
): { roundUpAmount: number; roundedTotal: number } | null {
  const roundUpAmount = calculateRoundUp(transactionAmount, nearestUnit);
  if (roundUpAmount <= 0) return null;
  return {
    roundUpAmount,
    roundedTotal: transactionAmount + roundUpAmount,
  };
}
