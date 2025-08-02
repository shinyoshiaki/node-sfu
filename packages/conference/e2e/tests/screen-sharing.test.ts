import {
  test,
  expect,
  createConferencePage,
  createDualClientSetup,
  setupRoomCreatorAndJoiner,
  cleanupDualClient,
  waitForRemoteVideos,
} from "../fixture.js";

test.describe("Conference Application - Screen Sharing", () => {
  test("should start and stop screen sharing in debug mode", async ({
    page,
  }) => {
    const conferencePage = createConferencePage(page);

    await conferencePage.goto("?debug=true");
    await conferencePage.createRoom();
    await conferencePage.waitForConnection();
    await conferencePage.waitForLocalVideo();

    // Initially screen sharing should be off
    expect(await conferencePage.isScreenSharingOn()).toBe(false);
    expect(await conferencePage.hasScreenShareVideo()).toBe(false);

    // Start screen sharing
    await conferencePage.toggleScreenShare();
    await expect(async () => {
      expect(await conferencePage.isScreenSharingOn()).toBe(true);
      expect(await conferencePage.hasScreenShareVideo()).toBe(true);
    }).toPass({ timeout: 5000 });

    // Stop screen sharing
    await conferencePage.toggleScreenShare();
    await expect(async () => {
      expect(await conferencePage.isScreenSharingOn()).toBe(false);
      expect(await conferencePage.hasScreenShareVideo()).toBe(false);
    }).toPass({ timeout: 5000 });
  });

  test("should receive screen share from other participant", async ({
    browser,
  }) => {
    const setup = await createDualClientSetup(browser);

    try {
      await setupRoomCreatorAndJoiner(setup, "Alice", "Bob", {
        debugMode: true,
      });

      // Wait for remote video establishment
      await waitForRemoteVideos(setup.conference1, setup.conference2, {
        conference1: 1,
        conference2: 1,
      });

      // Client2 starts screen sharing
      await setup.conference2.toggleScreenShare();
      await expect(async () => {
        expect(await setup.conference2.isScreenSharingOn()).toBe(true);
      }).toPass({ timeout: 5000 });

      // Client1 should receive client2's screen share
      await expect(async () => {
        const hasRemoteScreenShare =
          await setup.conference1.hasRemoteScreenShare(0);
        expect(hasRemoteScreenShare).toBe(true);
      }).toPass({ timeout: 10000 });

      // Client2 stops screen sharing
      await setup.conference2.toggleScreenShare();
      await expect(async () => {
        expect(await setup.conference2.isScreenSharingOn()).toBe(false);
      }).toPass({ timeout: 5000 });

      // Client1 should no longer see screen share
      await expect(async () => {
        const hasRemoteScreenShare =
          await setup.conference1.hasRemoteScreenShare(0);
        expect(hasRemoteScreenShare).toBe(false);
      }).toPass({ timeout: 10000 });
    } finally {
      await cleanupDualClient(setup);
    }
  });
});
