/**
 * lib/wallet-providers/freighter.ts
 *
 * Freighter browser-extension wallet provider.  Wraps the inline
 * `window.freighter` logic that previously lived in `useWallet.ts`.
 */

import type {
  WalletProvider,
  WalletProviderId,
  WalletProviderMeta,
} from './types';

declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      requestAccess: () => Promise<string>;
      signTransaction: (
        xdr: string,
        network: string,
      ) => Promise<string | { signedTxXdr?: string }>;
    };
  }
}

export class FreighterProvider implements WalletProvider {
  readonly id: WalletProviderId = 'freighter';

  private _publicKey: string | null = null;

  getMeta(): WalletProviderMeta {
    return {
      id: 'freighter',
      name: 'Freighter',
      description: 'Browser extension for Stellar — quick and easy.',
      isAvailable: typeof window !== 'undefined' && !!window.freighter,
      kind: 'extension',
    };
  }

  /** @inheritdoc */
  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && !!window.freighter;
  }

  /** @inheritdoc */
  async connect(): Promise<string> {
    if (!(await this.isAvailable())) {
      window.open('https://freighter.app', '_blank', 'noopener,noreferrer');
      throw new Error('Freighter not found. Install the extension to continue.');
    }

    const publicKey = await window.freighter!.requestAccess();
    if (!publicKey) throw new Error('No public key returned.');
    this._publicKey = publicKey;
    return publicKey;
  }

  /** @inheritdoc */
  disconnect(): void {
    this._publicKey = null;
  }

  /** @inheritdoc */
  async signTransaction(xdr: string, network: string): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error('Freighter is not installed.');
    }

    const result = await window.freighter!.signTransaction(xdr, network);
    const signedXdr =
      typeof result === 'string' ? result : result?.signedTxXdr;

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
