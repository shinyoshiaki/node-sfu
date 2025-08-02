import {
  test,
  expect,
  createConferencePage,
  createDualClientSetup,
  createTripleClientSetup,
  cleanupDualClient,
  cleanupTripleClient,
  setupDualClientChat,
  setupTripleClientChat,
  extractRoomId,
  openChatPanel,
  sendChatMessage,
  verifyChatPanelVisible,
  verifyMessageReceived,
  verifyMessageCount,
} from "../fixture.js";

test.describe("Conference Text Chat - RED PHASE (Failing Tests)", () => {
  test("chat panel toggle scenario", async ({ page }) => {
    const conferencePage = createConferencePage(page);

    await conferencePage.goto();
    await conferencePage.createRoom();
    await conferencePage.waitForConnection();
    await conferencePage.waitForLocalVideo();

    // This should fail - chat button doesn't exist yet
    await expect(async () => {
      const chatButton = page.locator('[data-testid="chat-toggle-button"]');
      await expect(chatButton).toBeVisible();
    }).toPass({ timeout: 1000 });

    // This should fail - clicking non-existent button
    await page.click('[data-testid="chat-toggle-button"]');

    // This should fail - chat panel doesn't exist yet
    await expect(async () => {
      const chatPanel = page.locator('[data-testid="chat-panel"]');
      await expect(chatPanel).toBeVisible();
    }).toPass({ timeout: 1000 });

    // This should fail - close button doesn't exist yet
    await page.click('[data-testid="chat-close-button"]');

    // This should fail - panel should be hidden but it doesn't exist
    await expect(async () => {
      const chatPanel = page.locator('[data-testid="chat-panel"]');
      await expect(chatPanel).not.toBeVisible();
    }).toPass({ timeout: 1000 });
  });

  test("message send/receive scenario", async ({ browser }) => {
    const setup = await createDualClientSetup(browser);
    const { client1, client2 } = setup;
    const name1 = "Alice";
    const name2 = "Bob";

    try {
      await setupDualClientChat(setup, name1, name2);

      // This should fail - chat functionality doesn't exist yet
      await expect(async () => {
        // Open chat on both clients
        await openChatPanel(client1);
        await openChatPanel(client2);

        // Send message from Alice
        await sendChatMessage(client1, "Hello Bob!");

        // Check if Bob receives the message
        await verifyMessageReceived(client2, "Hello Bob!", name1);
      }).toPass({ timeout: 5000 });
    } finally {
      await cleanupDualClient(setup);
    }
  });

  test("video call + chat integration scenario", async ({ browser }) => {
    const setup = await createDualClientSetup(browser);
    const { client1, client2, conference1, conference2 } = setup;
    const name1 = "Alice";
    const name2 = "Bob";

    try {
      await setupDualClientChat(setup, name1, name2);

      // Wait for video connection
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      // This should fail - chat during video call integration doesn't exist yet
      await expect(async () => {
        // Verify video is working
        expect(await conference1.hasLocalVideoStream()).toBe(true);
        expect(await conference2.hasLocalVideoStream()).toBe(true);

        // Enable microphone on Alice
        await conference1.toggleMicrophone();

        // Open chat panel
        await openChatPanel(client1);
        await openChatPanel(client2);

        // Send chat message during video call
        await sendChatMessage(client1, "Video chat test");

        // Verify both video and chat work simultaneously
        expect(await conference1.hasLocalVideoStream()).toBe(true);
        expect(await conference2.hasLocalVideoStream()).toBe(true);
        expect(await conference1.isMicrophoneOn()).toBe(true);

        await verifyMessageReceived(client2, "Video chat test", name1);
      }).toPass({ timeout: 10000 });
    } finally {
      await cleanupDualClient(setup);
    }
  });

  test("unread message indicator scenario", async ({ browser }) => {
    const setup = await createDualClientSetup(browser);
    const { client1, client2 } = setup;

    try {
      await setupDualClientChat(setup, "Alice", "Bob");

      // This should fail - unread indicator functionality doesn't exist yet
      await expect(async () => {
        // Alice opens chat and sends message
        await openChatPanel(client1);
        await sendChatMessage(client1, "Hello");

        // Bob should see unread indicator (without opening chat)
        const unreadIndicator = client2.locator('[data-testid="unread-count"]');
        await expect(unreadIndicator).toBeVisible();
        await expect(unreadIndicator).toContainText("1");

        // Bob opens chat, unread count should disappear
        await openChatPanel(client2);
        await expect(unreadIndicator).not.toBeVisible();
      }).toPass({ timeout: 5000 });
    } finally {
      await cleanupDualClient(setup);
    }
  });

  test("Phase 1 PubSub pattern end-to-end scenario", async ({ browser }) => {
    const setup = await createDualClientSetup(browser);
    const { client1, client2, conference1, conference2 } = setup;
    const user1Name = "Alice";
    const user2Name = "Bob";

    try {
      await setupDualClientChat(setup, user1Name, user2Name);

      // Wait for video connection
      await expect(async () => {
        const client1RemoteCount = await conference1.getRemoteVideoCount();
        expect(client1RemoteCount).toBe(1);
      }).toPass({ timeout: 10000 });

      // Phase 1 scenario: Real chat scenario simulation using UI
      await openChatPanel(client1);
      await openChatPanel(client2);

      // Verify chat panels are open
      await verifyChatPanelVisible(client1);
      await verifyChatPanelVisible(client2);

      // Alice sends message "Hello Bob!" as in Phase 1 test
      await sendChatMessage(client1, "Hello Bob!");

      // Wait for message to appear on Bob's side
      await verifyMessageReceived(client2, "Hello Bob!", user1Name);

      // Verify message metadata matches Phase 1 expectations
      const messageElement = client2
        .locator('[data-testid="message-item"]')
        .first();
      await expect(messageElement).toContainText("Hello Bob!");
      await expect(messageElement).toContainText(user1Name);

      // Test bidirectional communication - Bob replies
      await sendChatMessage(client2, "Hi Alice!");

      // Verify Alice receives Bob's message
      await verifyMessageCount(client1, 2);
      await verifyMessageReceived(client1, "Hi Alice!", user2Name, 1);
    } finally {
      await cleanupDualClient(setup);
    }
  });

  test("Large message transmission scenario", async ({ browser }) => {
    const setup = await createDualClientSetup(browser);
    const { client1, client2 } = setup;

    try {
      await setupDualClientChat(setup, "Alice", "Bob");

      // Open chat panels
      await openChatPanel(client1);
      await openChatPanel(client2);

      // Send large message (similar to Phase 1 test with 10KB content)
      const largeContent = "A".repeat(1000); // Reduced size for E2E test performance
      await sendChatMessage(client1, largeContent);

      // Verify large message is received correctly
      await verifyMessageReceived(client2, largeContent, "Alice", 0, 10000);

      // Verify message content length
      const messageContent = await client2
        .locator('[data-testid="message-item"]')
        .first()
        .textContent();
      expect(messageContent).toContain(largeContent);
    } finally {
      await cleanupDualClient(setup);
    }
  });

  test("Multi-participant chat scenario", async ({ browser }) => {
    const setup = await createTripleClientSetup(browser);
    const { client1, client2, client3 } = setup;

    try {
      await setupTripleClientChat(setup, "Alice", "Bob", "Charlie");

      // Open chat on all clients
      await openChatPanel(client1);
      await openChatPanel(client2);
      await openChatPanel(client3);

      // Each participant sends a message
      await sendChatMessage(client1, "Message from Alice");
      await sendChatMessage(client2, "Message from Bob");
      await sendChatMessage(client3, "Message from Charlie");

      // Verify all participants see all messages
      await verifyMessageCount(client1, 3, 10000);
      await verifyMessageCount(client2, 3, 10000);
      await verifyMessageCount(client3, 3, 10000);
    } finally {
      await cleanupTripleClient(setup);
    }
  });
});
