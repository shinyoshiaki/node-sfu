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

  async goto(params?: string) {
    const url = params ? `/${params}` : "/";
    await this.page.goto(url);
  }

  async enterParticipantName(name: string) {
    await this.page.fill('[data-testid="participant-name-input"]', name);
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

  async getLocalParticipantName() {
    const nameElement = this.page.locator(
      '[data-testid="local-participant-name"]',
    );
    const nameText = await nameElement.textContent();
    // Remove " (You)" suffix for test compatibility
    return (nameText || "").replace(" (You)", "");
  }

  async getRemoteParticipantName(index = 0) {
    const nameElement = this.page.locator(
      `[data-testid="remote-participant-name-${index}"]`,
    );
    const nameText = await nameElement.textContent();
    return (nameText || "").trim();
  }

  async toggleCamera() {
    await this.page.click('[data-testid="camera-toggle-btn"]');
  }

  async toggleMicrophone() {
    await this.page.click('[data-testid="microphone-toggle-btn"]');
    // Wait a bit for the microphone toggle to complete
    await this.page.waitForTimeout(3000);
  }

  async isCameraOn() {
    return await this.page.evaluate(() => {
      const video = document.querySelector(
        '[data-testid="local-video"]',
      ) as HTMLVideoElement;
      if (!video?.srcObject) return false;
      const stream = video.srcObject as MediaStream;
      const videoTracks = stream.getVideoTracks();
      return videoTracks.length > 0 && videoTracks[0].enabled;
    });
  }

  async isMicrophoneOn() {
    return await this.page.evaluate(() => {
      const video = document.querySelector(
        '[data-testid="local-video"]',
      ) as HTMLVideoElement;
      if (!video?.srcObject) return false;
      const stream = video.srcObject as MediaStream;
      const audioTracks = stream.getAudioTracks();
      console.log("Audio tracks count:", audioTracks.length);
      if (audioTracks.length > 0) {
        console.log("First audio track enabled:", audioTracks[0].enabled);
      }
      return audioTracks.length > 0 && audioTracks[0].enabled;
    });
  }

  async getCameraButtonAppearance() {
    const button = this.page.locator('[data-testid="camera-toggle-btn"]');
    const isActive = await button.evaluate((el) =>
      el.classList.contains("bg-[#3c4043]"),
    );
    return isActive ? "on" : "off";
  }

  async getMicrophoneButtonAppearance() {
    const button = this.page.locator('[data-testid="microphone-toggle-btn"]');
    const isActive = await button.evaluate((el) =>
      el.classList.contains("bg-[#3c4043]"),
    );
    return isActive ? "on" : "off";
  }

  async hasRemoteAudioIndicator(index = 0) {
    // In the new UI, we only show an indicator when audio is OFF (muted)
    // Audio ON state doesn't show any indicator
    const remoteVideo = this.page.locator(
      `[data-testid="remote-video-${index}"]`,
    );
    const muteIndicator = remoteVideo.locator(
      '..//div[contains(@class, "bg-red-500")]',
    );
    // Return true if there is NO mute indicator (meaning audio is on)
    return (await muteIndicator.count()) === 0;
  }

  // Screen sharing methods
  async toggleScreenShare() {
    await this.page.click('[data-testid="screen-share-button"]');
  }

  async isScreenSharingOn() {
    return await this.page.evaluate(() => {
      const button = document.querySelector(
        '[data-testid="screen-share-button"]',
      );
      // When screen sharing is ON, the button shows as inactive (red background)
      // When screen sharing is OFF, the button shows as active (dark background)
      return button?.classList.contains("bg-[#ea4335]") || false;
    });
  }

  async hasScreenShareVideo() {
    const screenShareVideo = this.page.locator(
      '[data-testid="screen-share-video"]',
    );
    const isVisible = await screenShareVideo.isVisible().catch(() => false);
    if (!isVisible) return false;

    return await this.page.evaluate(() => {
      const video = document.querySelector(
        '[data-testid="screen-share-video"]',
      ) as HTMLVideoElement;
      return video?.srcObject !== null;
    });
  }

  async hasRemoteScreenShare(index = 0) {
    const screenShareVideo = this.page.locator(
      '[data-testid="screen-share-video"]',
    );
    const isVisible = await screenShareVideo.isVisible().catch(() => false);
    if (!isVisible) return false;

    return await this.page.evaluate(() => {
      const video = document.querySelector(
        '[data-testid="screen-share-video"]',
      ) as HTMLVideoElement;
      return video?.srcObject !== null;
    });
  }
}

// Helper function to create page object
export function createConferencePage(page: Page) {
  return new ConferencePageObject(page);
}

// Multi-client setup utilities
export interface MultiClientSetup {
  context1: any;
  context2: any;
  client1: Page;
  client2: Page;
  conference1: ConferencePageObject;
  conference2: ConferencePageObject;
}

export async function createDualClientSetup(
  browser: any,
): Promise<MultiClientSetup> {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const client1 = await context1.newPage();
  const client2 = await context2.newPage();

  const conference1 = createConferencePage(client1);
  const conference2 = createConferencePage(client2);

  return {
    context1,
    context2,
    client1,
    client2,
    conference1,
    conference2,
  };
}

export async function setupRoomCreatorAndJoiner(
  setup: MultiClientSetup,
  creatorName?: string,
  joinerName?: string,
  options?: { debugMode?: boolean },
): Promise<{ roomId: string }> {
  const { conference1, conference2, client1 } = setup;

  // First participant creates room
  const params = options?.debugMode ? "?debug=true" : undefined;
  await conference1.goto(params);
  if (creatorName) {
    await conference1.enterParticipantName(creatorName);
  }
  await conference1.createRoom();
  await conference1.waitForConnection();
  await conference1.waitForLocalVideo();

  const roomId = await client1.evaluate(() => {
    const codeElement = document.querySelector("code");
    return codeElement?.textContent || null;
  });

  if (!roomId) {
    throw new Error("Failed to get room ID");
  }

  // Second participant joins
  await conference2.goto(params);
  if (joinerName) {
    await conference2.enterParticipantName(joinerName);
  }
  await conference2.joinRoom(roomId);
  await conference2.waitForConnection();
  await conference2.waitForLocalVideo();

  return { roomId };
}

export async function cleanupDualClient(
  setup: MultiClientSetup,
): Promise<void> {
  try {
    await setup.context1.close();
  } catch {
    // Ignore cleanup errors
  }
  try {
    await setup.context2.close();
  } catch {
    // Ignore cleanup errors
  }
}

export async function waitForRemoteVideos(
  conference1: ConferencePageObject,
  conference2: ConferencePageObject,
  expectedCounts: { conference1?: number; conference2?: number },
  timeout = 10000,
): Promise<void> {
  await expect(async () => {
    const client1RemoteCount = await conference1.getRemoteVideoCount();
    const client2RemoteCount = await conference2.getRemoteVideoCount();

    if (expectedCounts.conference1 !== undefined) {
      expect(client1RemoteCount).toBe(expectedCounts.conference1);
    }
    if (expectedCounts.conference2 !== undefined) {
      expect(client2RemoteCount).toBe(expectedCounts.conference2);
    }
  }).toPass({ timeout });
}

// Multi-client setup for three participants
export interface TripleClientSetup {
  context1: any;
  context2: any;
  context3: any;
  client1: Page;
  client2: Page;
  client3: Page;
  conference1: ConferencePageObject;
  conference2: ConferencePageObject;
  conference3: ConferencePageObject;
}

export async function createTripleClientSetup(
  browser: any,
): Promise<TripleClientSetup> {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const context3 = await browser.newContext();
  const client1 = await context1.newPage();
  const client2 = await context2.newPage();
  const client3 = await context3.newPage();

  const conference1 = createConferencePage(client1);
  const conference2 = createConferencePage(client2);
  const conference3 = createConferencePage(client3);

  return {
    context1,
    context2,
    context3,
    client1,
    client2,
    client3,
    conference1,
    conference2,
    conference3,
  };
}

export async function cleanupTripleClient(
  setup: TripleClientSetup,
): Promise<void> {
  try {
    await setup.context1.close();
  } catch {
    // Ignore cleanup errors
  }
  try {
    await setup.context2.close();
  } catch {
    // Ignore cleanup errors
  }
  try {
    await setup.context3.close();
  } catch {
    // Ignore cleanup errors
  }
}

// Room ID extraction utility
export async function extractRoomId(page: Page): Promise<string> {
  const roomId = await page.evaluate(() => {
    const codeElement = document.querySelector("code");
    return codeElement?.textContent || null;
  });

  if (!roomId) {
    throw new Error("Failed to extract room ID from page");
  }

  return roomId;
}

// Chat-specific utilities
export async function openChatPanel(page: Page): Promise<void> {
  await page.click('[data-testid="chat-toggle-button"]');
}

export async function sendChatMessage(page: Page, message: string): Promise<void> {
  await page.fill('[data-testid="chat-input"]', message);
  await page.press('[data-testid="chat-input"]', 'Enter');
}

export async function verifyChatPanelVisible(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
}

export async function verifyMessageReceived(
  page: Page,
  message: string,
  senderName: string,
  messageIndex = 0,
  timeout = 5000,
): Promise<void> {
  await expect(async () => {
    const messages = page.locator('[data-testid="message-item"]');
    await expect(messages).toHaveCount(messageIndex + 1);
    const targetMessage = messageIndex === 0 ? messages.first() : messages.nth(messageIndex);
    await expect(targetMessage).toContainText(message);
    await expect(targetMessage).toContainText(senderName);
  }).toPass({ timeout });
}

export async function verifyMessageCount(
  page: Page,
  expectedCount: number,
  timeout = 5000,
): Promise<void> {
  await expect(async () => {
    const messages = page.locator('[data-testid="message-item"]');
    await expect(messages).toHaveCount(expectedCount);
  }).toPass({ timeout });
}

export async function setupDualClientChat(
  setup: MultiClientSetup,
  name1: string,
  name2: string,
): Promise<{ roomId: string }> {
  const { conference1, conference2, client1 } = setup;

  // First participant creates room
  await conference1.goto();
  await conference1.enterParticipantName(name1);
  await conference1.createRoom();
  await conference1.waitForConnection();
  await conference1.waitForLocalVideo();

  const roomId = await extractRoomId(client1);

  // Second participant joins
  await conference2.goto();
  await conference2.enterParticipantName(name2);
  await conference2.joinRoom(roomId);
  await conference2.waitForConnection();
  await conference2.waitForLocalVideo();

  return { roomId };
}

export async function setupTripleClientChat(
  setup: TripleClientSetup,
  name1: string,
  name2: string,
  name3: string,
): Promise<{ roomId: string }> {
  const { conference1, conference2, conference3, client1 } = setup;

  // First participant creates room
  await conference1.goto();
  await conference1.enterParticipantName(name1);
  await conference1.createRoom();
  await conference1.waitForConnection();

  const roomId = await extractRoomId(client1);

  // Second participant joins
  await conference2.goto();
  await conference2.enterParticipantName(name2);
  await conference2.joinRoom(roomId);
  await conference2.waitForConnection();

  // Third participant joins
  await conference3.goto();
  await conference3.enterParticipantName(name3);
  await conference3.joinRoom(roomId);
  await conference3.waitForConnection();

  // Wait for all connections to be established
  await new Promise(resolve => setTimeout(resolve, 3000));

  return { roomId };
}
