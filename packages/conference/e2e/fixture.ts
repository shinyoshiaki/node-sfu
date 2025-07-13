import { test as base, expect, type Page } from "@playwright/test";

// Test context setup
export const test = base.extend<{
  serverUrl: string;
}>({
  serverUrl: async ({ baseURL }, use) => {
    // Use the baseURL from playwright config which includes the dynamic port
    const serverUrl =
      process.env.SERVER_URL || baseURL || "http://localhost:4001";
    await use(serverUrl);
  },
});

export { expect };

// Common test utilities
export class ConferencePageObject {
  constructor(private page: Page) {
    // Capture console logs from the browser
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[Browser ${type}] ${text}`);
    });

    // Capture any page errors
    page.on("pageerror", (error) => {
      console.error(`[Page Error] ${error.message}`);
    });
  }

  async goto() {
    await this.page.goto("/");
  }

  async createRoom() {
    await this.page.click('[data-testid="create-room-btn"]');
  }

  async joinRoom(roomId: string) {
    await this.page.fill('[data-testid="room-id-input"]', roomId);
    await this.page.click('[data-testid="join-room-btn"]');
  }

  async waitForConnection(timeout = 15000) {
    // Wait for the page to transition to conference page first
    await this.page.waitForSelector('[data-testid="connection-status"]', {
      timeout,
    });

    // Then wait for it to show "connected" status
    await this.page.waitForFunction(
      () => {
        const statusElement = document.querySelector(
          '[data-testid="connection-status"]',
        );
        return statusElement?.textContent === "connected";
      },
      { timeout },
    );
  }

  async waitForLocalVideo(timeout = 15000) {
    await this.page.waitForSelector('[data-testid="local-video"]', { timeout });
    // Also wait for the video stream to be attached
    await this.page.waitForFunction(
      () => {
        const video = document.querySelector(
          '[data-testid="local-video"]',
        ) as HTMLVideoElement;
        return video?.srcObject !== null;
      },
      { timeout: timeout },
    );
  }

  async waitForRemoteVideo(index = 0, timeout = 20000) {
    await this.page.waitForSelector(`[data-testid="remote-video-${index}"]`, {
      timeout,
    });
    // Also wait for the video stream to be attached
    await this.page.waitForFunction(
      (idx) => {
        const video = document.querySelector(
          `[data-testid="remote-video-${idx}"]`,
        ) as HTMLVideoElement;
        return video?.srcObject !== null;
      },
      index,
      { timeout },
    );
  }

  async getConnectionStatus() {
    const statusElement = this.page.locator(
      '[data-testid="connection-status"]',
    );
    const statusText = await statusElement.textContent();
    return statusText || "unknown";
  }

  async hasLocalVideoStream() {
    return await this.page.evaluate(() => {
      const video = document.querySelector(
        '[data-testid="local-video"]',
      ) as HTMLVideoElement;
      return video?.srcObject !== null;
    });
  }

  async hasRemoteVideoStream(index = 0) {
    return await this.page.evaluate((index) => {
      const video = document.querySelector(
        `[data-testid="remote-video-${index}"]`,
      ) as HTMLVideoElement;
      return video?.srcObject !== null;
    }, index);
  }

  async getRemoteVideoCount() {
    return await this.page.locator('[data-testid^="remote-video-"]').count();
  }

  async leaveRoom() {
    await this.page.click('[data-testid="leave-room-btn"]');
  }
}

// Helper function to create page object
export function createConferencePage(page: Page) {
  return new ConferencePageObject(page);
}
