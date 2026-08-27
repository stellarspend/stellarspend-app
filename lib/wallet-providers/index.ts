/**
 * lib/wallet-providers/index.ts
 *
 * Central registry of all wallet providers.  Import from here to get
 * the full list or individual providers.
 */

import type { WalletProvider, WalletProviderId, WalletProviderMeta } from './types';
import { FreighterProvider } from './freighter';
import { LedgerProvider } from './ledger';
import { XBullProvider } from './xbull';
import { AlbedoProvider } from './albedo';

export type { WalletProvider, WalletProviderId, WalletProviderMeta } from './types';
export { FreighterProvider } from './freighter';
export { LedgerProvider } from './ledger';
export { XBullProvider } from './xbull';
export { AlbedoProvider } from './albedo';

/** Singleton instances of each provider. */
const providers: Record<WalletProviderId, WalletProvider> = {
  freighter: new FreighterProvider(),
  ledger: new LedgerProvider(),
  xbull: new XBullProvider(),
  albedo: new AlbedoProvider(),
};

/** Return all registered providers. */
export function getAllProviders(): WalletProvider[] {
  return Object.values(providers);
}

/** Get a specific provider by ID. */
export function getProvider(id: WalletProviderId): WalletProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown wallet provider: ${id}`);
  return provider;
}

/**
 * Return metadata for all providers including real-time availability.
 * Used by the WalletProviderPicker UI.
 */
export async function getProviderMetaList(): Promise<WalletProviderMeta[]> {
  const all = getAllProviders();
  const meta = await Promise.all(
    all.map(async (p) => {
      const m = p.getMeta();
      const available = await p.isAvailable().catch(() => false);
      return { ...m, isAvailable: available };
    }),
  );
  return meta;
}
