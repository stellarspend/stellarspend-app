/**
 * lib/wallet-providers/ledgerStub.ts
 *
 * Build-time stand-in for the optional Ledger hardware peer-dependencies
 * (`@ledgerhq/hw-transport-webusb`, `@ledgerhq/hw-app-str`), which are not
 * installed. The aliases below (see `next.config.ts`) map those bare specifiers
 * to this stub so bundlers can resolve them without a failing `module not found`
 * error while keeping the Ledger libraries out of the dependency tree.
 *
 * Ledger is a hardware-only path: it is never available in server-side or CI
 * environments, so attempting to actually use it surfaces a clear error.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stub: any = class LedgerStub {
  static create() {
    throw new Error(
      'Ledger support is unavailable: the @ledgerhq peer dependencies are not installed.',
    );
  }
};

export default stub;