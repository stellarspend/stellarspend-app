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

  beforeEach(() => {
    cy.visit("/dashboard/settings");
    // Reset the persisted language so tests are independent of each other
    cy.clearLocalStorage(LANGUAGE_KEY);
    cy.reload();
    cy.get("html").should("have.attr", "dir", "ltr");
  });

  it("switches to Arabic and mirrors the layout to RTL", () => {
    // List variant on the settings page exposes each language as a button
    // tagged with its BCP-47 code.
    cy.get('button[lang="ar"]').click();

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
    cy.get('button[lang="ar"]').click();
    cy.get("html").should("have.attr", "dir", "rtl");

    cy.reload();

    cy.get("html").should("have.attr", "dir", "rtl");
    cy.get("html").should("have.attr", "lang", "ar");
    cy.get('button[lang="ar"]').should("have.class", "border-[#e8b84b]");
  });

  it("switches back to English (LTR)", () => {
    cy.get('button[lang="ar"]').click();
    cy.get("html").should("have.attr", "dir", "rtl");

    cy.get('button[lang="en"]').click();
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
