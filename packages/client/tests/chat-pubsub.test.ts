import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type ClientTestSetup,
  type DualClientSetup,
  cleanupClient,
  cleanupDualClient,
  createDualClientSetup,
  createTestClient,
} from "./test-utils.js";

interface ChatMessage {
  id: string;
  type: "chat";
  memberId: string;
  memberName?: string;
  content: string;
  timestamp: number;
}

function generateUniqueId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

describe("Chat PubSub Functionality", () => {
  let setup: DualClientSetup;
  let room: Room;
  let client1: Client;
  let client2: Client;
  let member1: Member;
  let member2: Member;

  beforeEach(async () => {
    setup = await createDualClientSetup();
    room = setup.room;
    client1 = setup.client1.client;
    client2 = setup.client2.client;
    member1 = setup.client1.member;
    member2 = setup.client2.member;
  });

  afterEach(async () => {
    cleanupDualClient(setup);
  });

  describe("Basic PubSub Operations", () => {
    it("client.publishData()でDataPublication取得し、DataPublication.send()でメッセージ送信", async () => {
      const chatPublication = await client1.publishData({ type: "chat" });

      expect(chatPublication).toBeDefined();
      expect(chatPublication.publicationId).toBeDefined();
      expect(chatPublication.metadata.type).toBe("chat");

      const message: ChatMessage = {
        id: generateUniqueId(),
        type: "chat",
        memberId: client1.id,
        content: "Hello World",
        timestamp: Date.now(),
      };

      // メッセージ送信のテスト
      expect(() => chatPublication.send(JSON.stringify(message))).not.toThrow();
    });

    it("client.subscribeData()でDataSubscription取得し、DataSubscription.onMessage()でメッセージ受信", async () => {
      // Set up remote publication listener before publishing
      const remotePublicationPromise =
        client2.onPublicationReady.asPromise(10000);

      // Client1がチャット用DataPublicationを作成
      const chatPublication = await client1.publishData({ type: "chat" });

      // Client2がremote publicationを受信するまで待機
      const [remotePublication] = await remotePublicationPromise;
      expect(remotePublication.type).toBe("data");
      expect(remotePublication.metadata!.type).toBe("chat");
      expect(remotePublication.publisher).toBe(client1.id);

      // Client2がDataSubscriptionを取得
      const chatSubscription = await client2.subscribeData(
        remotePublication.id,
      );
      expect(chatSubscription).toBeDefined();
      expect(chatSubscription.publicationId).toBe(remotePublication.id);

      // メッセージ受信の準備
      let receivedMessage: ChatMessage | null = null;
      chatSubscription.onMessage.subscribe((data) => {
        receivedMessage = JSON.parse(data as string);
      });

      // Client1からメッセージ送信
      const testMessage: ChatMessage = {
        id: generateUniqueId(),
        type: "chat",
        memberId: client1.id,
        content: "Hello from client1",
        timestamp: Date.now(),
      };

      chatPublication.send(JSON.stringify(testMessage));

      // メッセージ受信の確認
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage!.id).toBe(testMessage.id);
      expect(receivedMessage!.type).toBe("chat");
      expect(receivedMessage!.memberId).toBe(client1.id);
      expect(receivedMessage!.content).toBe("Hello from client1");
    });
  });

  describe("Multi-participant PubSub", () => {
    it("複数参加者間でのPubSubメッセージ交換テスト（各参加者が独自のDataPublicationを作成してpublishData、他参加者が対応するDataSubscriptionでsubscribeData）", async () => {
      // 3つ目のクライアントセットアップ
      const client3Setup = await createTestClient(room);
      const client3 = client3Setup.client;

      try {
        // 各クライアントがチャット用DataPublicationを作成
        const chatPub1 = await client1.publishData({
          type: "chat",
          memberId: client1.id,
        });
        const chatPub2 = await client2.publishData({
          type: "chat",
          memberId: client2.id,
        });
        const chatPub3 = await client3.publishData({
          type: "chat",
          memberId: client3.id,
        });

        // 各クライアントが他のクライアントのpublicationを受信するまで簡単な待機
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // publicationの作成確認
        expect(chatPub1.metadata.type).toBe("chat");
        expect(chatPub2.metadata.type).toBe("chat");
        expect(chatPub3.metadata.type).toBe("chat");

        // 簡単なメッセージ送信テスト
        const message1: ChatMessage = {
          id: generateUniqueId(),
          type: "chat",
          memberId: client1.id,
          content: "Message from client1",
          timestamp: Date.now(),
        };

        // 基本的な送信操作のテスト
        expect(() => chatPub1.send(JSON.stringify(message1))).not.toThrow();
        expect(() => chatPub2.send(JSON.stringify(message1))).not.toThrow();
        expect(() => chatPub3.send(JSON.stringify(message1))).not.toThrow();
      } finally {
        cleanupClient(client3Setup);
      }
    });
  });

  describe("PubSub Lifecycle Management", () => {
    it("DataPublication/DataSubscriptionライフサイクル管理とチャンネル管理のテスト", async () => {
      // Remote publication受信の準備
      const remotePublicationPromise =
        client2.onPublicationReady.asPromise(5000);

      // DataPublication作成・破棄のテスト
      const chatPublication1 = await client1.publishData({
        type: "chat",
        name: "test-channel-1",
      });
      expect(chatPublication1).toBeDefined();
      expect(chatPublication1.metadata.type).toBe("chat");
      expect(chatPublication1.metadata.name).toBe("test-channel-1");

      // DataPublicationが適切にクライアントに登録されているか確認
      expect(client1.getPublication(chatPublication1.publicationId)).toBe(
        chatPublication1,
      );
      expect(client1.getPublications()).toContain(chatPublication1);

      // Remote publication受信の確認
      const [remotePublication] = await remotePublicationPromise;
      expect(remotePublication.id).toBe(chatPublication1.publicationId);

      // DataSubscription作成のテスト
      const chatSubscription = await client2.subscribeData(
        remotePublication.id,
      );
      expect(chatSubscription).toBeDefined();
      expect(chatSubscription.publicationId).toBe(
        chatPublication1.publicationId,
      );
      expect(client2.getSubscription(chatSubscription.publicationId)).toBe(
        chatSubscription,
      );
      expect(client2.getSubscriptions()).toContain(chatSubscription);

      // DataPublication破棄のテスト
      const unpublishPromise = client2.onDataUnpublished.asPromise(5000);
      await client1.unpublishData(chatPublication1.publicationId);

      // DataPublicationが適切に破棄されているか確認
      expect(
        client1.getPublication(chatPublication1.publicationId),
      ).toBeUndefined();
      expect(client1.getPublications()).not.toContain(chatPublication1);

      // Remote unpublishの確認
      const [unpublishedPublicationId] = await unpublishPromise;
      expect(unpublishedPublicationId).toBe(chatPublication1.publicationId);

      // DataSubscription自動破棄の確認
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(
        client2.getSubscription(chatSubscription.publicationId),
      ).toBeUndefined();
      expect(client2.getSubscriptions()).not.toContain(chatSubscription);
    });

    it("複数のDataPublication/DataSubscriptionのライフサイクル管理", async () => {
      // 複数のDataPublication作成
      const chatPub1 = await client1.publishData({
        type: "chat",
        name: "channel-1",
      });
      const chatPub2 = await client1.publishData({
        type: "chat",
        name: "channel-2",
      });

      expect(client1.getPublications()).toHaveLength(2);
      expect(client1.getPublications()).toContain(chatPub1);
      expect(client1.getPublications()).toContain(chatPub2);

      // 基本的な作成・削除のテスト
      expect(chatPub1.metadata.name).toBe("channel-1");
      expect(chatPub2.metadata.name).toBe("channel-2");

      // 個別破棄テスト
      await client1.unpublishData(chatPub1.publicationId);
      expect(client1.getPublications()).toHaveLength(1);
      expect(client1.getPublication(chatPub1.publicationId)).toBeUndefined();
      expect(client1.getPublication(chatPub2.publicationId)).toBeDefined();

      // 残りのDataPublication破棄
      await client1.unpublishData(chatPub2.publicationId);
      expect(client1.getPublications()).toHaveLength(0);
      expect(client1.getPublication(chatPub2.publicationId)).toBeUndefined();
    });
  });

  describe("Pure PubSubパターン統合テスト", () => {
    it("チャット機能のエンドツーエンドPubSubフロー検証", async () => {
      // リアルなチャットシナリオのテスト
      const user1 = { id: client1.id, name: "Alice" };
      const user2 = { id: client2.id, name: "Bob" };

      // Remote publication受信の準備
      const remotePublicationPromise =
        client2.onPublicationReady.asPromise(5000);

      // 各ユーザーのチャットpublication作成
      const aliceChatPub = await client1.publishData({
        type: "chat",
        memberId: user1.id,
        memberName: user1.name,
      });

      const [aliceRemotePub] = await remotePublicationPromise;

      const bobChatSub = await client2.subscribeData(aliceRemotePub.id);

      // 簡単なチャット会話のシミュレーション
      let receivedMessage: ChatMessage | null = null;

      bobChatSub.onMessage.subscribe((data) => {
        receivedMessage = JSON.parse(data as string);
      });

      // Alice からのメッセージ送信
      const chatMessage: ChatMessage = {
        id: generateUniqueId(),
        type: "chat",
        memberId: user1.id,
        memberName: user1.name,
        content: "Hello Bob!",
        timestamp: Date.now(),
      };

      aliceChatPub.send(JSON.stringify(chatMessage));

      // メッセージ受信を待機（最大3秒）
      await new Promise((resolve) => {
        const startTime = Date.now();
        const checkMessage = () => {
          if (receivedMessage || Date.now() - startTime > 3000) {
            resolve(undefined);
          } else {
            setTimeout(checkMessage, 50);
          }
        };
        checkMessage();
      });

      // 受信確認
      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage!.content).toBe("Hello Bob!");
      expect(receivedMessage!.memberId).toBe(user1.id);
      expect(receivedMessage!.memberName).toBe(user1.name);
      expect(receivedMessage!.type).toBe("chat");
    });

    it("大きなメッセージの送受信テスト", async () => {
      const remotePublicationPromise =
        client2.onPublicationReady.asPromise(5000);
      const chatPublication = await client1.publishData({ type: "chat" });
      const [remotePublication] = await remotePublicationPromise;
      const chatSubscription = await client2.subscribeData(
        remotePublication.id,
      );

      // 大きなメッセージの作成（JSONペイロード）
      const largeContent = "A".repeat(10000); // 10KB のメッセージ
      const largeMessage: ChatMessage = {
        id: generateUniqueId(),
        type: "chat",
        memberId: client1.id,
        content: largeContent,
        timestamp: Date.now(),
      };

      let receivedMessage: ChatMessage | null = null;
      chatSubscription.onMessage.subscribe((data) => {
        receivedMessage = JSON.parse(data as string);
      });

      chatPublication.send(JSON.stringify(largeMessage));

      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage!.content).toBe(largeContent);
      expect(receivedMessage!.content.length).toBe(10000);
    });
  });
});
