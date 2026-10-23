/// <reference types="cypress" />

/**
 * Language switching incl. Arabic RTL rendering (Issue #17).
 *
 * Verifies the LanguageSelector flips the document direction/lang attributes,
 * persists the choice to localStorage, survives a reload, and — for the RTL
 * case — captures a screenshot artifact so layout-mirroring bugs are visible
 * in CI even without a full pixel-diff harness.
 */
describe("i18n & RTL (#17)", () => {
  const LANGUAGE_KEY = "stellarspend_language";

  // Unique testid on the settings-page list variant so it is never ambiguous,
  // even while React concurrent transitions keep both old and new trees in DOM.
  const LIST = '[data-testid="language-list-settings"]';

  beforeEach(() => {
    cy.visit("/dashboard/settings");
    // Reset the persisted language so tests are independent of each other
    cy.clearLocalStorage(LANGUAGE_KEY);
    cy.reload();
    cy.get("html").should("have.attr", "dir", "ltr");
  });

  it("switches to Arabic and mirrors the layout to RTL", () => {
    // Wait for exactly one list container before scoping into it, so a stale
    // ghost left by a concurrent React transition can't make .within() fail.
    cy.get(LIST).should("have.length", 1).within(() => {
      cy.get('[data-testid="language-btn-ar"]').click();
    });

    cy.get("html").should("have.attr", "dir", "rtl");
    cy.get("html").should("have.attr", "lang", "ar");

    // The choice is persisted locally
    cy.window().then((win) => {
      expect(win.localStorage.getItem(LANGUAGE_KEY)).to.equal("ar");
    });

    // Screenshot artifact for visual review of the mirrored layout
    cy.screenshot("settings-arabic-rtl", { capture: "viewport" });
  });

  it("persists the language choice across a reload", () => {
    cy.get(LIST).should("have.length", 1).within(() => {
      cy.get('[data-testid="language-btn-ar"]').click();
    });
    cy.get("html").should("have.attr", "dir", "rtl");

    cy.reload();

    cy.get("html").should("have.attr", "dir", "rtl");
    cy.get("html").should("have.attr", "lang", "ar");
    cy.get(LIST)
      .should("have.length", 1)
      .find('[data-testid="language-btn-ar"]')
      .should("have.class", "border-[#e8b84b]");
  });

  it("switches back to English (LTR)", () => {
    cy.get(LIST).should("have.length", 1).within(() => {
      cy.get('[data-testid="language-btn-ar"]').click();
    });
    cy.get("html").should("have.attr", "dir", "rtl");

    // Wait for exactly one list (concurrent transition clears) then click English
    cy.get(LIST).should("have.length", 1).within(() => {
      cy.get('[data-testid="language-btn-en"]').click();
    });
    cy.get("html").should("have.attr", "dir", "ltr");
    cy.get("html").should("have.attr", "lang", "en");
  });

  it("switches language from the dashboard dropdown selector", () => {
    cy.visit("/dashboard");
    cy.get("select").filter(":visible").first().select("es");

    cy.get("html").should("have.attr", "lang", "es");
    cy.get("html").should("have.attr", "dir", "ltr");
    cy.window().then((win) => {
      expect(win.localStorage.getItem(LANGUAGE_KEY)).to.equal("es");
    });
  });
});
