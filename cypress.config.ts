import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunfailure: true,
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
    env: {
      socialMediaLinks: [
        { name: "Twitter", href: "https://twitter.com/footer", ariaLabel: "Twitter" },
        { name: "GitHub", href: "https://github.com/footer", ariaLabel: "GitHub" },
        { name: "LinkedIn", href: "https://linkedin.com/footer", ariaLabel: "LinkedIn" },
      ],
    },
  },
});