/**
 * lib/wallet-providers/types.ts
 *
 * Defines the abstract interface for all wallet providers (Freighter, Ledger,
 * xBull, Albedo). Every provider implements the same contract so the app can
 * swap between them without changing calling code.
 */

/** Identifies a wallet provider. */
export type WalletProviderId = 'freighter' | 'ledger' | 'xbull' | 'albedo';

/** State reported by a provider after attempting to connect. */
export interface WalletProviderConnection {
  /** Whether the provider's software (extension / USB device) is reachable. */
  isAvailable: boolean;
  /** Whether the user has granted access to their public key. */
  isConnected: boolean;
  /** The Stellar public key returned by the provider, if connected. */
  publicKey: string | null;
  /** True while a connect / request-access flow is in progress. */
  isConnecting: boolean;
  /** Human-readable error from the last failed operation, or null. */
  error: string | null;
}

/** Descriptor used by the WalletProviderPicker UI. */
export interface WalletProviderMeta {
  id: WalletProviderId;
  /** Human-readable name (e.g. "Freighter"). */
  name: string;
  /** Short description shown in the picker. */
  description: string;
  /** Whether this provider is currently available in the browser. */
  isAvailable: boolean;
  /** Wallet kind: "extension", "hardware", or "web". */
  kind: 'extension' | 'hardware' | 'web';
}

/**
 * Every concrete wallet provider must implement this interface.
 *
 * The methods mirror what Freighter currently does inline in `useWallet.ts`
 * but generalised so Ledger / xBull / Albedo can plug in.
 */
export interface WalletProvider {
  /** Unique identifier for this provider. */
  readonly id: WalletProviderId;

  /** Static metadata for UI rendering (availability is checked lazily). */
  getMeta(): WalletProviderMeta;

  /**
   * Check whether the provider is installed or reachable without prompting
   * the user.  For browser extensions this inspects `window`; for Ledger it
   * checks USB / WebHID availability.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Kick off the connection flow.  For Freighter this calls
   * `requestAccess`; for Ledger this opens the device selector and
   * retrieves the Stellar app public key.
   *
   * @returns The Stellar public key on success.
   * @throws On user rejection or communication failure.
   */
  connect(): Promise<string>;

  /** Disconnect / clear session state (extensions may not support this). */
  disconnect(): void;

  /**
   * Sign an XDR transaction envelope and return the signed XDR string.
   *
   * @param xdr       - Base64-encoded transaction envelope.
   * @param network   - The Stellar network passphrase or alias ('TESTNET' / 'PUBLIC').
   * @param publicKey - The public key of the signing account (needed by some providers).
   * @returns The signed, base64-encoded transaction envelope.
   */
  signTransaction(xdr: string, network: string, publicKey?: string): Promise<string>;

  /**
   * Returns the currently-known public key, or null if not connected.
   */
  getPublicKey(): string | null;
}
