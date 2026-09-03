/// <reference types="cypress" />

import { MOCK_PUBLIC_KEY } from "../support/commands";

/**
 * Send-and-confirm payment (Issue #3).
 *
 * Exercises the Send Payment modal on the dashboard: input validation, a
 * successful payment submission for amounts under the ZK threshold, and the
 * ZK-compliance warning shown for amounts above the threshold. Full in-browser
 * ZK proving is covered by the unit suite (lib/zk) — here we assert the UI
 * gate that surfaces before proving starts.
 */
describe("Send Payment (#3)", () => {
  beforeEach(() => {
    cy.visit("/dashboard");
    cy.get("#quick-action-send").click();
    cy.contains("h2", "Send Assets").should("be.visible");
  });

  it("validates the recipient address", () => {
    cy.contains("button", "Send Payment").click();
    cy.contains("Recipient address is required.").should("be.visible");
  });

  it("rejects a malformed Stellar address", () => {
    cy.get('input[placeholder="G..."]').type("not-a-valid-address");
    cy.get('input[placeholder="0.00"]').type("50");
    cy.contains("button", "Send Payment").click();
    cy.contains(
      "Recipient must be a valid 56-character Stellar public key starting with 'G'.",
    ).should("be.visible");
  });

  it("sends a payment and shows the confirmation", () => {
    cy.get('input[placeholder="G..."]').type(MOCK_PUBLIC_KEY);
    cy.get('input[placeholder="0.00"]').type("50");

    cy.contains("button", "Send Payment").click();

    // Signing → submitting → success
    cy.contains("h3", "Payment Completed", { timeout: 15000 }).should(
      "be.visible",
    );
    cy.contains("Back to Dashboard").should("be.visible");
    cy.contains("Transaction Hash:").should("be.visible");
  });

  it("flags payments above the ZK threshold with a compliance warning", () => {
    cy.get('input[placeholder="G..."]').type(MOCK_PUBLIC_KEY);
    cy.get('input[placeholder="0.00"]').type("150");

    cy.contains("ZK Compliance Required").should("be.visible");
  });
});
