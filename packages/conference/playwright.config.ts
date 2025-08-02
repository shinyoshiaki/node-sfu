import { defineConfig, devices } from "@playwright/test";

// Use dynamic ports from environment variables or random ports
const VITE_PORT = Number.parseInt(process.env.VITE_PORT || "3001");
const REFERENCE_SERVER_PORT = Number.parseInt(
  process.env.REFERENCE_SERVER_PORT || "4001",
);

export default defineConfig({
  testDir: "./e2e",
  // fullyParallel: false,
  forbidOnly: false,
  retries: 1,
  workers: 4,
  reporter: process.argv.includes("--reporter=list") ? "list" : "html",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: process.env.SERVER_URL || `http://localhost:${VITE_PORT}`,
    actionTimeout: 10000,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--allow-file-access-from-files",
            "--disable-web-security",
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: "npx vite",
      port: VITE_PORT,
      env: {
        VITE_PORT: String(VITE_PORT),
        VITE_SERVER_URL: `http://localhost:${REFERENCE_SERVER_PORT}`,
      },
      reuseExistingServer: true,
    },
    {
      command: "npm run dev",
      port: REFERENCE_SERVER_PORT,
      cwd: "../reference-server",
      env: { PORT: String(REFERENCE_SERVER_PORT) },
      reuseExistingServer: true,
    },
  ],
});
