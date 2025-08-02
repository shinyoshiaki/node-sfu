import { 
  test, 
  expect, 
  createConferencePage, 
  createDualClientSetup, 
  setupRoomCreatorAndJoiner, 
  cleanupDualClient, 
  waitForRemoteVideos 
} from "../fixture.js";

test.describe("Conference Application - Video Streaming", () => {
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

  test("should support multi-participant video session", async ({ browser }) => {
    const setup = await createDualClientSetup(browser);

    try {
      await setupRoomCreatorAndJoiner(setup);

      // Verify both participants connected with local video
      expect(await setup.conference1.getConnectionStatus()).toBe("connected");
      expect(await setup.conference2.getConnectionStatus()).toBe("connected");
      expect(await setup.conference1.hasLocalVideoStream()).toBe(true);
      expect(await setup.conference2.hasLocalVideoStream()).toBe(true);

      // Wait for remote video establishment
      await waitForRemoteVideos(setup.conference1, setup.conference2, { conference1: 1, conference2: 1 });
    } finally {
      await cleanupDualClient(setup);
    }
  });
});