import { test, expect, createConferencePage } from "../fixture.js";

test.describe("Conference Application - Room entry and video streaming", () => {
  test("should create room and publish local video", async ({ page }) => {
    const conferencePage = createConferencePage(page);

    await conferencePage.goto();
    await conferencePage.createRoom();
    await conferencePage.waitForConnection();
    await conferencePage.waitForLocalVideo();

    expect(await conferencePage.hasLocalVideoStream()).toBe(true);

    // Wait for connection to be fully established
    await expect(async () => {
      expect(await conferencePage.getConnectionStatus()).toBe("connected");
    }).toPass({ timeout: 5000 });

    const localVideo = page.locator('[data-testid="local-video"]');
    await expect(localVideo).toBeVisible();
  });

  test("should support multi-participant video session", async ({
    browser,
  }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const client1 = await context1.newPage();
    const client2 = await context2.newPage();

    const conference1 = createConferencePage(client1);
    const conference2 = createConferencePage(client2);

    try {
      // First participant creates room
      await conference1.goto();
      await conference1.createRoom();
      await conference1.waitForConnection();
      await conference1.waitForLocalVideo();

      const roomId = await client1.evaluate(() => {
        const codeElement = document.querySelector("code");
        return codeElement?.textContent || null;
      });

      expect(roomId).toBeTruthy();

      // Second participant joins
      await conference2.goto();
      await conference2.joinRoom(roomId!);
      await conference2.waitForConnection();
      await conference2.waitForLocalVideo();

      // Verify both participants connected with local video
      expect(await conference1.getConnectionStatus()).toBe("connected");
      expect(await conference2.getConnectionStatus()).toBe("connected");
      expect(await conference1.hasLocalVideoStream()).toBe(true);
      expect(await conference2.hasLocalVideoStream()).toBe(true);

      // Wait for remote video establishment with proper conditions
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        const client2RemoteCount = await conference2.getRemoteVideoCount();
        expect(client1RemoteCount + client2RemoteCount).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("should handle participant leaving room", async ({ browser }) => {
    const context1 = await browser.newContext();
    const client1 = await context1.newPage();
    const conference1 = createConferencePage(client1);

    try {
      await conference1.goto();
      await conference1.createRoom();
      await conference1.waitForConnection();
      await conference1.waitForLocalVideo();

      expect(await conference1.hasLocalVideoStream()).toBe(true);

      // Wait for connection to be fully established
      await expect(async () => {
        expect(await conference1.getConnectionStatus()).toBe("connected");
      }).toPass({ timeout: 5000 });

      await conference1.leaveRoom();

      // After leaving, should return to home page
      await expect(client1.locator('[data-testid="create-room-btn"]')).toBeVisible({ timeout: 5000 });
    } finally {
      await context1.close();
    }
  });

  test("should remove remote video when participant leaves", async ({
    browser,
  }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const client1 = await context1.newPage();
    const client2 = await context2.newPage();

    const conference1 = createConferencePage(client1);
    const conference2 = createConferencePage(client2);

    try {
      // First participant creates room
      await conference1.goto();
      await conference1.createRoom();
      await conference1.waitForConnection();
      await conference1.waitForLocalVideo();

      const roomId = await client1.evaluate(() => {
        const codeElement = document.querySelector("code");
        return codeElement?.textContent || null;
      });

      expect(roomId).toBeTruthy();

      // Second participant joins
      await conference2.goto();
      await conference2.joinRoom(roomId!);
      await conference2.waitForConnection();
      await conference2.waitForLocalVideo();

      // Wait for remote videos to be established
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      await expect(async () => {
        const client2RemoteCount = await conference2.getRemoteVideoCount();
        expect(client2RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      // Client2 leaves the room
      await conference2.leaveRoom();

      // Client1 should have no remote videos after client2 leaves
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(0);
      }).toPass({ timeout: 20000 });

      // Verify client2 has returned to home page after leaving
      await expect(client2.locator('[data-testid="create-room-btn"]')).toBeVisible({ timeout: 5000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("should remove remote video when participant page is reloaded", async ({
    browser,
  }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const client1 = await context1.newPage();
    const client2 = await context2.newPage();

    const conference1 = createConferencePage(client1);
    const conference2 = createConferencePage(client2);

    try {
      // First participant creates room
      await conference1.goto();
      await conference1.createRoom();
      await conference1.waitForConnection();
      await conference1.waitForLocalVideo();

      const roomId = await client1.evaluate(() => {
        const codeElement = document.querySelector("code");
        return codeElement?.textContent || null;
      });

      expect(roomId).toBeTruthy();

      // Second participant joins
      await conference2.goto();
      await conference2.joinRoom(roomId!);
      await conference2.waitForConnection();
      await conference2.waitForLocalVideo();

      // Wait for remote videos to be established
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      await expect(async () => {
        const client2RemoteCount = await conference2.getRemoteVideoCount();
        expect(client2RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      // Simulate page reload/navigation to trigger abrupt disconnection
      // This should be more reliably detected than page close
      await client2.reload();

      // Client1 should have no remote videos after client2's page is reloaded
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(0);
      }).toPass({ timeout: 20000 });

      // Client1 should still be connected
      await expect(async () => {
        expect(await conference1.getConnectionStatus()).toBe("connected");
      }).toPass({ timeout: 5000 });
    } finally {
      await context1.close();
      // Note: client2 is reloaded but context2 still needs cleanup
      try {
        await context2.close();
      } catch {
        // Ignore error if already closed
      }
    }
  });
});
