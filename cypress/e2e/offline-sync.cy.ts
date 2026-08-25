/// <reference types="cypress" />

/**
 * Offline queue creation, persistence, retry, and clear (Issue #6).
 *
 * The app's offline event dispatch has a known context-sharing issue in the
 * production build (Next.js+Turbopack chunking can create separate
 * OfflineContext instances for the dashboard's SendPaymentModal vs the
 * OfflineBanner, so window.dispatchEvent("offline") doesn't propagate to
 * the modal). To test the queue rendering reliably, this spec seeds
 * localStorage directly with queued-action data, then asserts that the
 * QueuedActions widget renders the badge, survives reloads, supports
 * retry, and can be cleared.
 *
 * When Issue #6's real retry/replay is implemented, extend these tests to
 * assert that retrying replays the action.
 */
describe("Offline Sync & Queue (#6)", () => {
  const QUEUE_KEY = "stellarspend_offline_queue";

  /** Seed a single queued SEND_PAYMENT action into localStorage. */
  const seedQueue = () => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify([
          {
            id: "test-q1",
            type: "SEND_PAYMENT",
            description: "Send 50 USDC to GDQP2K...",
            data: { recipient: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37", amount: 50, asset: "USDC" },
            timestamp: Date.now(),
          },
        ]),
      );
    });
  };

  beforeEach(() => {
    cy.visit("/dashboard");
    // Always start with a clean queue so tests don't leak into each other.
    cy.clearLocalStorage(QUEUE_KEY);
  });

  it("renders the queued-action badge when localStorage has queued data", () => {
    seedQueue();
    cy.reload();

    cy.get('[aria-label="1 queued action"]')
      .scrollIntoView()
      .should("exist");

    // Expand the panel to see the queued action details
    cy.contains("Queued Actions").click();
    cy.contains("SEND_PAYMENT").should("exist");
  });

  it("persists queued actions across a reload", () => {
    seedQueue();
    cy.reload();

    cy.get('[aria-label="1 queued action"]').should("exist");
    cy.reload();

    cy.get('[aria-label="1 queued action"]')
      .scrollIntoView()
      .should("exist");
  });

  it("keeps the queue intact when clicking retry", () => {
    seedQueue();
    cy.reload();

    cy.get('[aria-label="1 queued action"]').scrollIntoView().should("exist");
    cy.get('[aria-label="Retry queued actions"]')
      .scrollIntoView()
      .click();

    // retryQueuedActions currently re-renders without replaying, so
    // the queue should survive.
    cy.get('[aria-label="1 queued action"]').should("exist");
  });

  it("clears the queue and removes it from localStorage", () => {
    seedQueue();
    cy.reload();

    cy.get('[aria-label="Clear queue"]')
      .scrollIntoView()
      .click();

    cy.get('[aria-label="1 queued action"]').should("not.exist");
    cy.window().then((win) => {
      assert.isNull(win.localStorage.getItem(QUEUE_KEY));
    });
  });

  it("shows the offline banner immediately after going offline", () => {
    cy.goOffline();
    cy.contains("You are currently offline.").should("exist");
  });
});