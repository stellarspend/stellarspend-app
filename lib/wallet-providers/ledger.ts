/**
 * lib/wallet-providers/ledger.ts
 *
 * Ledger hardware wallet provider for Stellar.
 * Uses WebHID (via `@ledgerhq/hw-transport-webusb`) and
 * `@ledgerhq/hw-app-str` to communicate with the Stellar app on a
 * Ledger device.
 *
 * The peer-dependency packages are loaded dynamically so the app
 * remains bundle-friendly when no Ledger device is present.
 */

import type {
  WalletProvider,
  WalletProviderId,
  WalletProviderMeta,
} from './types';

export class LedgerProvider implements WalletProvider {
  readonly id: WalletProviderId = 'ledger';

  private _publicKey: string | null = null;
  // Lazily-loaded module references so we don't bloat the initial bundle.
  private _transport: unknown = null;
  private _app: unknown = null;

  getMeta(): WalletProviderMeta {
    return {
      id: 'ledger',
      name: 'Ledger',
      description: 'Hardware wallet — maximum custody security.',
      // WebUSB availability is a reasonable proxy for Ledger support.
      isAvailable:
        typeof navigator !== 'undefined' && 'usb' in navigator,
      kind: 'hardware',
    };
  }

  /** @inheritdoc */
  async isAvailable(): Promise<boolean> {
      try {
      return (
        typeof navigator !== 'undefined' && 'usb' in navigator
      );
    } catch {
      return false;
    }
  }

  /** @inheritdoc */
  async connect(): Promise<string> {
    // `loadTransport`/`loadApp` return unknown so cast locally for usage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TransportWebUSB = (await this.loadTransport()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Str = (await this.loadApp()) as any;

    // Open device — this triggers the browser's USB device picker.
    this._transport = await TransportWebUSB.create();
    this._app = new Str(this._transport);

    // The user must have the Stellar app open on the device.
    const { publicKey } = await (this._app as any).getAddress("44'/148'/0'");
    this._publicKey = publicKey;
    return publicKey;
  }

  /** @inheritdoc */
  disconnect(): void {
    if (this._transport) {
      (this._transport as any).close().catch(() => {});
      this._transport = null;
    }
    this._app = null;
    this._publicKey = null;
  }

  /** @inheritdoc */
  async signTransaction(
    xdr: string,
    _network: string,
    publicKey?: string,
  ): Promise<string> {
    if (!this._app) {
      throw new Error(
        'Ledger device not connected. Please connect and open the Stellar app.',
      );
    }

    if (!publicKey && !this._publicKey) {
      throw new Error('No public key available. Please connect first.');
    }

    const accountIndex = "44'/148'/0'";
    // signTransaction returns the signed TX as a Buffer / Uint8Array.
    // The second arg is the BIP-32 path index, defaulting to 0.
    const signedBuf = await (this._app as any).signTransaction(
      accountIndex,
      0, // signer index within the account
      Buffer.from(xdr, 'base64'),
    );

    return signedBuf.toString('base64');
  }

  /** @inheritdoc */
  getPublicKey(): string | null {
    return this._publicKey;
  }

  // ── Dynamic imports ──────────────────────────────────────────────────────

  private async loadTransport(): Promise<unknown> {
    // Dynamic import keeps the bundle small.
    const mod = await import('@ledgerhq/hw-transport-webusb');
    return mod.default;
  }

  private async loadApp(): Promise<unknown> {
    const mod = await import('@ledgerhq/hw-app-str');
    return mod.default;
  }
}
