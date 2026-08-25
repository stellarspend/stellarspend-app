/// <reference types="cypress" />

// ── Global type declarations ─────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Installs a deterministic mock of the Freighter browser extension on
       * `window.freighter`. Call after `cy.visit()` — the window is recreated
       * on every navigation, so the mock must be re-installed per visit.
       */
      mockFreighter(): Chainable<void>;
      /** Intercepts Stellar Horizon/Soroban calls the app makes while mocked. */
      mockStellarAPI(): Chainable<void>;
      /** Connects the mocked Freighter wallet via the navbar "Connect Wallet" button. */
      connectWallet(): Chainable<void>;
      /** Disconnects the connected Freighter wallet from the navbar menu. */
      disconnectWallet(): Chainable<void>;
      /** Fires the window `offline` event so OfflineProvider marks the app offline. */
      goOffline(): Chainable<void>;
      /** Fires the window `online` event so OfflineProvider marks the app online. */
      goOnline(): Chainable<void>;
    }
  }
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      getNetwork: () => Promise<string>;
      requestAccess: () => Promise<string>;
      signTransaction: (xdr: string, network?: string) => Promise<string>;
    };
  }
}

// ── Freighter wallet mock ────────────────────────────────────────────────────

/**
 * The deterministic public key used across the mocked flows. Must be a valid
 * 56-character Stellar address starting with "G".
 */
export const MOCK_PUBLIC_KEY =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

Cypress.Commands.add("mockFreighter", () => {
  return cy.fixture("wallet").then((wallet) => {
    cy.window().then((win) => {
      win.freighter = {
        isConnected: () => Promise.resolve(wallet.isConnected),
        getPublicKey: () => Promise.resolve(wallet.publicKey),
        getNetwork: () => Promise.resolve(wallet.network),
        requestAccess: () => Promise.resolve(wallet.publicKey),
        signTransaction: (xdr: string) => Promise.resolve(xdr),
      };
    });
  });
});

Cypress.Commands.add("connectWallet", () => {
  cy.mockFreighter();
  cy.get('header[role="banner"]')
    .contains("button", "Connect Wallet")
    .click();
  // Connected state shows the truncated public key (first 6 + last 4 chars).
  cy.get('header[role="banner"]')
    .contains("button", "GDQP2K...4W37")
    .should("be.visible");
});

Cypress.Commands.add("disconnectWallet", () => {
  cy.get('header[role="banner"]')
    .find('button[aria-label="Wallet menu"]')
    .click();
  cy.contains("button", "Disconnect").click();
  cy.get('header[role="banner"]')
    .contains("button", "Connect Wallet")
    .should("be.visible");
});

// ── Connectivity helpers ─────────────────────────────────────────────────────

Cypress.Commands.add("goOffline", () => {
  // Dispatch as a native Event so the addEventListener handlers in
  // OfflineProvider fire correctly.
  cy.window().then((win) => {
    win.dispatchEvent(new Event("offline"));
  });
  // Wait for the OfflineBanner to appear, which guarantees React has
  // finished re-rendering with isOnline=false before the next command.
  cy.contains("You are currently offline.").should("exist");
});

Cypress.Commands.add("goOnline", () => {
  cy.window().then((win) => {
    win.dispatchEvent(new Event("online"));
  });
});

// ── Stellar Horizon mock ─────────────────────────────────────────────────────

Cypress.Commands.add("mockStellarAPI", () => {
  return cy.fixture("transaction").then((transaction) => {
    cy.intercept("GET", "**/accounts/**", {
      statusCode: 200,
      body: {
        id: MOCK_PUBLIC_KEY,
        balances: [{ asset_type: "native", balance: "10000.0000000" }],
      },
    }).as("getAccount");

    cy.intercept("GET", "**/transactions**", {
      statusCode: 200,
      body: { _embedded: { records: [transaction] } },
    }).as("getTransactions");

    cy.intercept("POST", "**/transactions", {
      statusCode: 200,
      body: { hash: "mock-tx-hash", successful: true },
    }).as("submitTransaction");
  });
});

export {};
