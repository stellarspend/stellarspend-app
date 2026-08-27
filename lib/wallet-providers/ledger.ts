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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _transport: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _app: any = null;

  getMeta(): WalletProviderMeta {
    return {
      id: 'ledger',
      name: 'Ledger',
      description: 'Hardware wallet — maximum custody security.',
      // WebUSB availability is a reasonable proxy for Ledger support.
      isAvailable:
        typeof navigator !== 'undefined' && !!(navigator as unknown as Record<string, unknown>).usb,
      kind: 'hardware',
    };
  }

  /** @inheritdoc */
  async isAvailable(): Promise<boolean> {
    try {
      return (
        typeof navigator !== 'undefined' && !!(navigator as unknown as Record<string, unknown>).usb
      );
    } catch {
      return false;
    }
  }

  /** @inheritdoc */
  async connect(): Promise<string> {
    const TransportWebUSB = await this.loadTransport();
    const Str = await this.loadApp();

    // Open device — this triggers the browser's USB device picker.
    this._transport = await TransportWebUSB.create();
    this._app = new Str(this._transport);

    // The user must have the Stellar app open on the device.
    const { publicKey } = await this._app.getAddress("44'/148'/0'");
    this._publicKey = publicKey;
    return publicKey;
  }

  /** @inheritdoc */
  disconnect(): void {
    if (this._transport) {
      this._transport.close().catch(() => {});
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
    const signedBuf = await this._app.signTransaction(
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadTransport(): Promise<any> {
    // Dynamic import keeps the bundle small.
    // @ts-expect-error — peer deps may not be installed yet.
    const mod = await import('@ledgerhq/hw-transport-webusb');
    return mod.default;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadApp(): Promise<any> {
    // @ts-expect-error — peer deps may not be installed yet.
    const mod = await import('@ledgerhq/hw-app-str');
    return mod.default;
  }
}
