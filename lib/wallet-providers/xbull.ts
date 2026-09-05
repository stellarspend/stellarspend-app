/**
 * lib/wallet-providers/xbull.ts
 *
 * xBull wallet provider — a popular Stellar wallet extension.
 */

import type {
  WalletProvider,
  WalletProviderId,
  WalletProviderMeta,
} from './types';

declare global {
  interface Window {
    xBull?: {
      connect(): Promise<string>;
      signTransaction(xdr: string): Promise<string>;
      getAddress(): Promise<string>;
    };
  }
}

export class XBullProvider implements WalletProvider {
  readonly id: WalletProviderId = 'xbull';

  private _publicKey: string | null = null;

  getMeta(): WalletProviderMeta {
    return {
      id: 'xbull',
      name: 'xBull',
      description: 'Browser extension wallet for Stellar.',
      isAvailable: typeof window !== 'undefined' && !!window.xBull,
      kind: 'extension',
    };
  }

  /** @inheritdoc */
  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && !!window.xBull;
  }

  /** @inheritdoc */
  async connect(): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error('xBull not found. Install the extension to continue.');
    }

    const publicKey = await window.xBull!.connect();
    if (!publicKey) throw new Error('No public key returned.');
    this._publicKey = publicKey;
    return publicKey;
  }

  /** @inheritdoc */
  disconnect(): void {
    this._publicKey = null;
  }

  /** @inheritdoc */
  async signTransaction(xdr: string): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error('xBull is not installed.');
    }

    const signedXdr = await window.xBull!.signTransaction(xdr);
    if (!signedXdr) {
      throw new Error('Transaction signing rejected by user.');
    }
    return signedXdr;
  }

  /** @inheritdoc */
  getPublicKey(): string | null {
    return this._publicKey;
  }
}
