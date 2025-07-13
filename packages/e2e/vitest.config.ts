/// <reference types="@vitest/browser/providers/playwright" />

import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills()],
  test: {
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      instances: [
        {
          browser: "chromium",
          launch: {
            args: [
              "--use-fake-ui-for-media-stream",
              "--use-fake-device-for-media-stream",
            ],
          },
        },
      ],
    },
    retry: 1,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
