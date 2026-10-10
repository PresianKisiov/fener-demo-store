import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
export const E2E_ADMIN = { email: "admin@fener.test", password: "Fener-Demo-2026" };

// Optional: E2E_DATABASE_URL=postgres://... runs the same tests against a real Postgres
// (an empty database: the build creates the tables and the demo data).
const pgUrl = process.env.E2E_DATABASE_URL;

/**
 * End-to-end tests: a real browser clicks through the shop and the admin panel.
 * They use their own database folder (.data/e2e), so your dev data is not touched.
 * Run with `npm run test:e2e` (first time: `npx playwright install chromium`).
 */
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
    // Most tests start with cookies already chosen, so the banner does not cover buttons.
    // The banner itself has its own test (consent.spec.ts) with an empty browser.
    storageState: {
      cookies: [{ name: "fener_consent", value: "necessary", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
      origins: [],
    },
  },
  webServer: {
    command: pgUrl
      ? `npm run build && npx next start -p ${PORT}`
      : `node -e "require('fs').rmSync('.data/e2e',{recursive:true,force:true})" && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      ...(pgUrl ? { DATABASE_URL: pgUrl } : { PGLITE_DATA_DIR: ".data/e2e" }),
      APP_URL: `http://localhost:${PORT}`,
      ADMIN_EMAIL: E2E_ADMIN.email,
      ADMIN_PASSWORD: E2E_ADMIN.password,
      SESSION_SECRET: "e2e-session-secret",
      MOCK_WEBHOOK_SECRET: "e2e-webhook-secret",
      PAYMENT_PROVIDER: "mock",
      // No network in tests: both couriers are simulated.
      ECONT_MODE: "mock",
      SPEEDY_MODE: "mock",
      MOCK_COURIER_STEP_MINUTES: "0",
      // A made-up Pixel id: the browser test intercepts the request to Meta.
      META_PIXEL_ID: "1234567890",
    },
  },
});
