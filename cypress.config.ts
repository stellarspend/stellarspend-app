import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10_000,
    // Retry once in headless (CI) runs to absorb flaky waits; no retries in
    // interactive mode so failures surface immediately while developing.
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents() {
      // implement node event listeners right here
    },
  },
});
