/// <reference types="cypress" />

import { MOCK_PUBLIC_KEY } from "../support/commands";

/**
 * Wallet connection / disconnection (Issue #2).
 *
 * Covers the navbar Freighter flow: connect via "Connect Wallet", see the
 * truncated + full public key, and disconnect back to the disconnected state.
 */
describe("Wallet Connection (#2)", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("shows the connect button when no wallet is connected", () => {
    cy.get('header[role="banner"]')
      .contains("button", "Connect Wallet")
      .should("be.visible");
  });

  it("connects a Freighter wallet and shows the truncated public key", () => {
    cy.connectWallet();
  });

  it("surfaces the full public key in the connected wallet menu", () => {
    cy.connectWallet();

    cy.get('header[role="banner"]')
      .find('button[aria-label="Wallet menu"]')
      .click();

    // Full public key is shown in the "Connected Wallet" panel
    cy.contains("p", MOCK_PUBLIC_KEY).should("be.visible");
    cy.contains("button", "Copy public key").should("be.visible");
    cy.contains("button", "Disconnect").should("be.visible");
  });

  it("disconnects the wallet back to the disconnected state", () => {
    cy.connectWallet();
    cy.disconnectWallet();

    // Disconnected state again
    cy.get('header[role="banner"]')
      .contains("button", "Connect Wallet")
      .should("be.visible");
  });

  it("shows a helpful error when Freighter is not installed", () => {
    // Ensure no Freighter extension is mocked on this window
    cy.window().then((win) => {
      delete win.freighter;
    });

    cy.get('header[role="banner"]')
      .contains("button", "Connect Wallet")
      .click();

    cy.contains(
      "Freighter not found. Install the extension to continue.",
    ).should("be.visible");
  });
});
