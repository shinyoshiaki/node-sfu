import { test, expect, createConferencePage } from "../fixture.js";

test.describe("Conference Application - Media Controls", () => {
  test("should toggle camera on/off", async ({ page }) => {
    const conferencePage = createConferencePage(page);

    await conferencePage.goto();
    await conferencePage.createRoom();
    await conferencePage.waitForConnection();
    await conferencePage.waitForLocalVideo();

    // Initially camera should be on (video stream should exist)
    expect(await conferencePage.hasLocalVideoStream()).toBe(true);
    expect(await conferencePage.isCameraOn()).toBe(true);

    // Click camera button to turn off
    await conferencePage.toggleCamera();
    await expect(async () => {
      expect(await conferencePage.isCameraOn()).toBe(false);
    }).toPass({ timeout: 5000 });

    // Click camera button to turn back on
    await conferencePage.toggleCamera();
    await expect(async () => {
      expect(await conferencePage.isCameraOn()).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test("should toggle microphone on/off", async ({ page }) => {
    const conferencePage = createConferencePage(page);

    await conferencePage.goto();
    await conferencePage.createRoom();
    await conferencePage.waitForConnection();
    await conferencePage.waitForLocalVideo();

    // Initially microphone should be off (we start with audio: false)
    expect(await conferencePage.isMicrophoneOn()).toBe(false);

    // Click microphone button to turn on
    await conferencePage.toggleMicrophone();
    await expect(async () => {
      expect(await conferencePage.isMicrophoneOn()).toBe(true);
    }).toPass({ timeout: 5000 });

    // Click microphone button to turn off
    await conferencePage.toggleMicrophone();
    await expect(async () => {
      expect(await conferencePage.isMicrophoneOn()).toBe(false);
    }).toPass({ timeout: 5000 });
  });

  test("should reflect camera and microphone state in UI", async ({ page }) => {
    const conferencePage = createConferencePage(page);

    await conferencePage.goto();
    await conferencePage.createRoom();
    await conferencePage.waitForConnection();
    await conferencePage.waitForLocalVideo();

    // Check initial UI state
    expect(await conferencePage.getCameraButtonAppearance()).toBe("on");
    expect(await conferencePage.getMicrophoneButtonAppearance()).toBe("off");

    // Toggle camera off and check UI
    await conferencePage.toggleCamera();
    await expect(async () => {
      expect(await conferencePage.getCameraButtonAppearance()).toBe("off");
    }).toPass({ timeout: 5000 });

    // Toggle microphone on and check UI
    await conferencePage.toggleMicrophone();
    await expect(async () => {
      expect(await conferencePage.getMicrophoneButtonAppearance()).toBe("on");
    }).toPass({ timeout: 5000 });
  });

  test("should show audio indicator when remote participant has microphone on", async ({
    browser,
  }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const client1 = await context1.newPage();
    const client2 = await context2.newPage();

    const conference1 = createConferencePage(client1);
    const conference2 = createConferencePage(client2);

    const name1 = "Alice";
    const name2 = "Bob";

    try {
      // First participant creates room
      await conference1.goto();
      await conference1.enterParticipantName(name1);
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
      await conference2.enterParticipantName(name2);
      await conference2.joinRoom(roomId!);
      await conference2.waitForConnection();
      await conference2.waitForLocalVideo();

      // Wait for remote video establishment
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      // Initially, client2 should not have audio indicator on client1's view
      await expect(async () => {
        const hasAudio = await conference1.hasRemoteAudioIndicator(0);
        expect(hasAudio).toBe(false);
      }).toPass({ timeout: 5000 });

      // Turn on client2's microphone
      await conference2.toggleMicrophone();

      // Now client1 should see audio indicator for client2
      await expect(async () => {
        const hasAudio = await conference1.hasRemoteAudioIndicator(0);
        expect(hasAudio).toBe(true);
      }).toPass({ timeout: 10000 });

      // todo fix toggleをoffにしようとする時点でpublish処理が完了していない可能性がある
      await new Promise((r) => setTimeout(r, 1000));

      // Turn off client2's microphone
      await conference2.toggleMicrophone();

      // Now client1 should NOT see audio indicator for client2
      await expect(async () => {
        const hasAudio = await conference1.hasRemoteAudioIndicator(0);
        expect(hasAudio).toBe(false);
      }).toPass({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
