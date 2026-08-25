/// <reference types="cypress" />

/**
 * Budget & savings-goal creation and persistence across reload (Issue #5).
 *
 * The app falls back to a deterministic local-storage data layer in CI where
 * no Soroban contract addresses are configured. "Persistence" here means:
 * create a budget/goal, confirm it renders, reload, and confirm it survives.
 */
describe("Budgets & Goals Persistence (#5)", () => {
  const BUDGETS_KEY = "stellarspend_local_budgets";
  const GOALS_KEY = "stellarspend_local_goals";

  describe("Budgets", () => {
    beforeEach(() => {
      cy.visit("/dashboard/budgets");
      cy.clearLocalStorage(BUDGETS_KEY);
      cy.reload();
    });

    it("creates a budget that persists across a reload", () => {
      cy.contains("button", "Create Budget").click();

      cy.get("input#name").type("Groceries");
      cy.get("input#amount").type("250");
      cy.get("select#category").select("food");
      cy.get('input[type="radio"][value="monthly"]').check();

      cy.contains("button", "Save Budget").should("not.be.disabled").click();

      // Budget card renders with name + amount
      cy.contains("h3", "Groceries").should("be.visible");
      cy.contains("250 XLM").should("be.visible");

      // Survives a full page reload
      cy.reload();
      cy.contains("h3", "Groceries").should("be.visible");
      cy.contains("250 XLM").should("be.visible");
    });

    it("persists the budget to the local storage bucket", () => {
      cy.contains("button", "Create Budget").click();

      cy.get("input#name").type("Transport");
      cy.get("input#amount").type("120");
      cy.get("select#category").select("transport");
      cy.get('input[type="radio"][value="monthly"]').check();

      cy.contains("button", "Save Budget").click();
      cy.contains("h3", "Transport").should("be.visible");

      cy.window().then((win) => {
        const raw = win.localStorage.getItem(BUDGETS_KEY);
        assert.isNotNull(raw, "budget should be persisted");
        const parsed = JSON.parse(raw as string);
        const created = parsed.find(
          (b: { name: string }) => b.name === "Transport",
        );
        assert.exists(created);
        assert.equal(created.amount, 120);
        assert.equal(created.category, "transport");
      });
    });
  });

  describe("Savings Goals", () => {
    beforeEach(() => {
      cy.clearLocalStorage(GOALS_KEY);
    });

    it("persists a goal across a reload (local-storage fallback path)", () => {
      // Seed a completed goal directly into localStorage. This is the
      // same data shape the createGoal flow produces when
      // SAVINGS_CONTRACT_ID is not configured (the CI default).
      cy.window().then((win) => {
        win.localStorage.setItem(
          GOALS_KEY,
          JSON.stringify([
            {
              id: "goal_test_1",
              name: "Emergency Fund",
              targetAmount: 1000,
              currentAmount: 0,
              deadline: "2027-12-31",
              recurrence: "once",
              createdAt: new Date().toISOString(),
            },
          ]),
        );
      });

      cy.visit("/dashboard");

      // Goal renders on the dashboard — use `exist` instead of `visible`
      // because the Card's parent overflow may clip the element in xvfb.
      cy.contains("Emergency Fund").scrollIntoView().should("exist");

      // Survives a full page reload
      cy.reload();
      cy.contains("Emergency Fund").scrollIntoView().should("exist");
    });
  });
});