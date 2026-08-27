/**
 * lib/wallet-providers/albedo.ts
 *
 * Albedo wallet provider — web-based Stellar wallet that opens in a
 * popup window. Unlike browser extensions, Albedo is always "available"
 * since it operates via a popup rather than an injected window object.
 */

import type {
  WalletProvider,
  WalletProviderId,
  WalletProviderMeta,
} from './types';

declare global {
  interface Window {
    Albedo?: {
      publicKey(params: { token?: string }): Promise<{ pubkey: string }>;
      txIntent(params: {
        xdr: string;
        network?: string;
        submit?: boolean;
      }): Promise<{ signed_envelope_xdr: string; tx_hash: string }>;
    };
  }
}

export class AlbedoProvider implements WalletProvider {
  readonly id: WalletProviderId = 'albedo';

  private _publicKey: string | null = null;

  getMeta(): WalletProviderMeta {
    return {
      id: 'albedo',
      name: 'Albedo',
      description: 'Web wallet — no extension needed, works anywhere.',
      // Albedo is always reachable via popup, but check for the SDK
      isAvailable: true,
      kind: 'web',
    };
  }

  /** @inheritdoc */
  async isAvailable(): Promise<boolean> {
    // Albedo SDK is loaded via <script> tag or npm; the popup always works.
    return true;
  }

  /** @inheritdoc */
  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Albedo is only available in the browser.');
    }

    // Dynamically load the Albedo SDK if not already loaded
    if (!window.Albedo) {
      await this.loadAlbedoSDK();
    }

    if (!window.Albedo) {
      throw new Error('Albedo SDK failed to load. Please try again.');
    }

    const result = await window.Albedo.publicKey({});
    if (!result?.pubkey) throw new Error('No public key returned from Albedo.');

    this._publicKey = result.pubkey;
    return result.pubkey;
  }

  /** @inheritdoc */
  disconnect(): void {
    this._publicKey = null;
  }

  /** @inheritdoc */
  async signTransaction(xdr: string, network: string): Promise<string> {
    if (typeof window === 'undefined' || !window.Albedo) {
      throw new Error('Albedo is not available.');
    }

    const networkPassphrase = network.includes('Test')
      ? 'Test SDF Network ; September 2015'
      : 'Public Global Stellar Network ; September 2015';

    const result = await window.Albedo.txIntent({
      xdr,
      network: networkPassphrase,
      submit: false,
    });

    if (!result?.signed_envelope_xdr) {
      throw new Error('Transaction signing rejected by user.');
    }

    return result.signed_envelope_xdr;
  }

  /** @inheritdoc */
  getPublicKey(): string | null {
    return this._publicKey;
  }

  /** Dynamically load the Albedo SDK script. */
  private async loadAlbedoSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="albedo"]')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@albedo-link/intent/lib/albedo.intent.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Albedo SDK.'));
      document.head.appendChild(script);
    });
  }
}
