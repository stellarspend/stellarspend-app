/**
 * lib/stellar/formatAmount.ts
 *
 * Formats amounts returned by the analytics contract (stringified i128, in
 * the asset's smallest unit) into human-readable numbers, per asset.
 *
 * ASSUMPTION: 7 decimal places for all three supported assets, which is
 * standard for XLM and for Soroban-issued/wrapped USDC & EURC on Stellar.
 * If this repo already has a decimals map (e.g. in lib/stellar/assets.ts),
 * import and use that instead of ASSET_DECIMALS below.
 */

import type { SupportedAsset } from './analyticsContract';

export const ASSET_DECIMALS: Record<SupportedAsset, number> = {
  XLM: 7,
  USDC: 7,
  EURC: 7,
};

export const ASSET_SYMBOL: Record<SupportedAsset, string> = {
  XLM: 'XLM',
  USDC: 'USDC',
  EURC: 'EURC',
};

/**
 * Converts a stringified smallest-unit i128 amount into a JS number.
 * Safe for display purposes; do not use this for further precise math.
 *
 * @param amount - Stringified i128 amount in the asset's smallest unit (e.g. stroops).
 * @param asset - Supported asset whose decimal places are applied for conversion.
 * @returns The human-readable numeric value for display.
 */
export function stroopsToDisplay(amount: string, asset: SupportedAsset): number {
  const decimals = ASSET_DECIMALS[asset];
  const divisor = 10 ** decimals;
  return Number(amount) / divisor;
}

/**
 * Formats a stringified smallest-unit amount as a localized string with the asset symbol.
 *
 * @param amount - Stringified i128 amount in the asset's smallest unit (e.g. stroops).
 * @param asset - Supported asset used for decimals and the display symbol.
 * @returns A locale-formatted amount string including the asset symbol (e.g. "1.00 XLM").
 */
export function formatAssetAmount(amount: string, asset: SupportedAsset): string {
  const value = stroopsToDisplay(amount, asset);
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${ASSET_SYMBOL[asset]}`;
}
