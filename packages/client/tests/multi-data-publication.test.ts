import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createDualClientSetup,
} from "./test-utils.js";

describe("Multiple data publication and subscription", () => {
  let setup: DualClientSetup;
  let room: Room;
  let client: Client; // Publisher
  let client2: Client; // Subscriber
  let member: Member;
  let member2: Member;

  beforeEach(async () => {
    setup = await createDualClientSetup();
    room = setup.room;
    client = setup.client1.client;
    client2 = setup.client2.client;
    member = setup.client1.member;
    member2 = setup.client2.member;
  });

  afterEach(async () => {
    cleanupDualClient(setup);
  });

  it(
    "should publish multiple data channels with different metadata and handle messaging",
    { timeout: 30000 },
    async () => {
      // 1. Metadata定義
      const chatMetadata = {
        type: "chat",
        priority: "high",
        encrypted: false,
      };

      const fileTransferMetadata = {
        type: "file-transfer",
        priority: "medium",
        maxSize: "10MB",
      };

      const notificationMetadata = {
        type: "notification",
        priority: "low",
        persistent: true,
      };

      // 2. RemotePublication受信待機セットアップ
      const chatPromise = client2.onPublicationReady.asPromise(10000);

      // 3. Chat DataPublication作成
      const chatPub = await client.publishData(chatMetadata);
      expect(chatPub).toBeDefined();
      expect(chatPub.metadata).toEqual(chatMetadata);

      // 4. Chat RemotePublication受信確認
      const [chatRemotePublication] = await chatPromise;
      expect(chatRemotePublication).toBeDefined();
      expect(chatRemotePublication.metadata).toEqual(chatMetadata);
      expect(chatRemotePublication.id).toBe(chatPub.publicationId);

      // 5. FileTransfer RemotePublication受信待機セットアップ
      const filePromise = client2.onPublicationReady.asPromise(10000);

      // 6. FileTransfer DataPublication作成
      const filePub = await client.publishData(fileTransferMetadata);
      expect(filePub).toBeDefined();
      expect(filePub.metadata).toEqual(fileTransferMetadata);

      // 7. FileTransfer RemotePublication受信確認
      const [fileRemotePublication] = await filePromise;
      expect(fileRemotePublication).toBeDefined();
      expect(fileRemotePublication.metadata).toEqual(fileTransferMetadata);
      expect(fileRemotePublication.id).toBe(filePub.publicationId);

      // 8. Notification RemotePublication受信待機セットアップ
      const notificationPromise = client2.onPublicationReady.asPromise(10000);

      // 9. Notification DataPublication作成
      const notificationPub = await client.publishData(notificationMetadata);
      expect(notificationPub).toBeDefined();
      expect(notificationPub.metadata).toEqual(notificationMetadata);

      // 10. Notification RemotePublication受信確認
      const [notificationRemotePublication] = await notificationPromise;
      expect(notificationRemotePublication).toBeDefined();
      expect(notificationRemotePublication.metadata).toEqual(
        notificationMetadata,
      );
      expect(notificationRemotePublication.id).toBe(
        notificationPub.publicationId,
      );

      // 11. DataSubscription作成
      const chatSub = await client2.subscribeData(chatPub.publicationId);
      const fileSub = await client2.subscribeData(filePub.publicationId);
      const notificationSub = await client2.subscribeData(
        notificationPub.publicationId,
      );

      // 12. 基本検証
      expect(chatSub).toBeDefined();
      expect(fileSub).toBeDefined();
      expect(notificationSub).toBeDefined();
      expect(chatSub.publicationId).toBe(chatPub.publicationId);
      expect(fileSub.publicationId).toBe(filePub.publicationId);
      expect(notificationSub.publicationId).toBe(notificationPub.publicationId);

      // 13. 複数のDataSubscription管理確認
      const subscriptions = client2.getDataSubscriptions();
      expect(subscriptions).toHaveLength(3);
      expect(subscriptions).toContain(chatSub);
      expect(subscriptions).toContain(fileSub);
      expect(subscriptions).toContain(notificationSub);

      // 14. 並行メッセージング検証
      const chatMessagePromise = chatSub.onMessage.asPromise(5000);
      const fileMessagePromise = fileSub.onMessage.asPromise(5000);
      const notificationMessagePromise =
        notificationSub.onMessage.asPromise(5000);

      // 15. 異なるタイプのメッセージを同時送信
      const chatMessage = "Hello from chat!";
      const fileMessage = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const notificationMessage = JSON.stringify({
        type: "alert",
        text: "New notification",
      });

      chatPub.send(chatMessage);
      filePub.send(fileMessage);
      notificationPub.send(notificationMessage);

      // 16. メッセージ受信確認
      const [receivedChat] = await chatMessagePromise;
      const [receivedFile] = await fileMessagePromise;
      const [receivedNotification] = await notificationMessagePromise;

      expect(receivedChat).toBe(chatMessage);
      expect(new Uint8Array(receivedFile as ArrayBuffer)).toEqual(fileMessage);
      expect(receivedNotification).toBe(notificationMessage);

      // 17. 双方向通信テスト（client2 → client）
      const reverseChatPromise = client.onPublicationReady.asPromise(10000);
      const reverseChatPub = await client2.publishData({
        type: "reverse-chat",
      });
      const [reverseChatRemote] = await reverseChatPromise;

      const reverseChatSub = await client.subscribeData(
        reverseChatPub.publicationId,
      );
      const reverseMessagePromise = reverseChatSub.onMessage.asPromise(5000);

      reverseChatPub.send("Hello back!");
      const [reverseMessage] = await reverseMessagePromise;
      expect(reverseMessage).toBe("Hello back!");
    },
  );

  it("should handle unpublishing one of multiple data publications", async () => {
    const pub1 = await client.publishData({ name: "channel1" });
    const pub2 = await client.publishData({ name: "channel2" });
    const pub3 = await client.publishData({ name: "channel3" });

    expect(client.getPublications()).toHaveLength(3);

    const sub1 = await client2.subscribeData(pub1.publicationId);
    const sub2 = await client2.subscribeData(pub2.publicationId);
    const sub3 = await client2.subscribeData(pub3.publicationId);

    expect(client2.getSubscriptions()).toHaveLength(3);

    const unpublishPromise = client2.onDataUnpublished.asPromise(5000);

    await client.unpublishData(pub2.publicationId);

    const [unpublishedId] = await unpublishPromise;
    expect(unpublishedId).toBe(pub2.publicationId);

    expect(client.getPublications()).toHaveLength(2);
    expect(client2.getSubscriptions()).toHaveLength(2);
    expect(client.getPublication(pub1.publicationId)).toBeDefined();
    expect(client.getPublication(pub2.publicationId)).toBeUndefined();
    expect(client.getPublication(pub3.publicationId)).toBeDefined();
  });

  it("should handle concurrent messaging across multiple data channels", async () => {
    const pub1 = await client.publishData({ name: "fast-channel" });
    const pub2 = await client.publishData({ name: "slow-channel" });

    const sub1 = await client2.subscribeData(pub1.publicationId);
    const sub2 = await client2.subscribeData(pub2.publicationId);

    const messages1: string[] = [];
    const messages2: string[] = [];

    sub1.onMessage.subscribe((msg) => messages1.push(msg as string));
    sub2.onMessage.subscribe((msg) => messages2.push(msg as string));

    const sendPromises: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      sendPromises.push(
        (async () => {
          pub1.send(`fast-${i}`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          pub2.send(`slow-${i}`);
        })(),
      );
    }

    await Promise.all(sendPromises);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(messages1).toHaveLength(5);
    expect(messages2).toHaveLength(5);
    expect(messages1).toEqual([
      "fast-0",
      "fast-1",
      "fast-2",
      "fast-3",
      "fast-4",
    ]);
    expect(messages2).toEqual([
      "slow-0",
      "slow-1",
      "slow-2",
      "slow-3",
      "slow-4",
    ]);
  });
});
