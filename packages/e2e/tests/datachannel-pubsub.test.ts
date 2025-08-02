import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "../../client/src/index.js";
import {
  type ClientSetup,
  cleanupClients,
  createAndSetupClient,
  createRoom,
  setupMultipleClients,
  waitForConnections,
} from "./fixture.js";

describe("DataChannel Pub-Sub - Cross-client data communication", () => {
  let publisher: Client;
  let subscriber: Client;
  let roomId: string;
  let publisherMemberId: string;
  let subscriberMemberId: string;

  beforeAll(async () => {
    roomId = await createRoom();
    const [publisherSetup, subscriberSetup] = await setupMultipleClients(
      roomId,
      2,
    );

    publisher = publisherSetup.client;
    publisherMemberId = publisherSetup.memberId;
    subscriber = subscriberSetup.client;
    subscriberMemberId = subscriberSetup.memberId;
  });

  afterAll(async () => {
    cleanupClients([publisher, subscriber]);
  });

  it("should notify all participants when publication is created", async () => {
    const publicationPromise = publisher.publishData();

    // Subscriber should receive publication ready notification
    const [remotePublication] = await subscriber.onPublicationReady.asPromise();
    const publication = await publicationPromise;

    expect(publication.publicationId).toBe(remotePublication.id);
    expect(remotePublication.type).toBe("data");
    expect(remotePublication.publisher).toBe(publisherMemberId);
  });

  it("should allow subscription to published data", async () => {
    const publication = await publisher.publishData();

    const subscription = await subscriber.subscribeData(
      publication.publicationId,
    );

    expect(subscription).toBeTruthy();
    expect(subscription.publicationId).toBe(publication.publicationId);
  });

  it("should relay messages between publisher and subscriber", async () => {
    const publication = await publisher.publishData();
    const subscription = await subscriber.subscribeData(
      publication.publicationId,
    );

    const receivedMessages: string[] = [];
    subscription.onMessage.subscribe((data) => {
      receivedMessages.push(data as string);
    });

    const testMessages = ["Hello", "World", "Test"];
    for (const message of testMessages) {
      publication.send(message);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessages.length).toBe(testMessages.length);
    testMessages.forEach((msg, i) => {
      expect(receivedMessages[i]).toBe(msg);
    });
  });

  it("should support multiple subscribers for same publication", async () => {
    const { client: subscriber2 } = await createAndSetupClient(roomId);

    try {
      const publication = await publisher.publishData();

      const subscription1 = await subscriber.subscribeData(
        publication.publicationId,
      );
      const subscription2 = await subscriber2.subscribeData(
        publication.publicationId,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const receivedMessages1: string[] = [];
      const receivedMessages2: string[] = [];

      subscription1.onMessage.subscribe((data) => {
        receivedMessages1.push(data as string);
      });
      subscription2.onMessage.subscribe((data) => {
        receivedMessages2.push(data as string);
      });

      const testMessage = "Broadcast message";
      publication.send(testMessage);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(receivedMessages1).toContain(testMessage);
      expect(receivedMessages2).toContain(testMessage);
    } finally {
      cleanupClients([subscriber2]);
    }
  });

  it("should prevent duplicate subscriptions to same publication", async () => {
    const publication = await publisher.publishData();

    // First subscription should succeed
    const subscription = await subscriber.subscribeData(
      publication.publicationId,
    );
    expect(subscription).toBeTruthy();

    // Second subscription attempt should fail
    try {
      await subscriber.subscribeData(publication.publicationId);
      expect.fail("Second subscription should have failed");
    } catch (error: any) {
      expect(error.message).toContain("Already subscribed to");
    }

    // Verify only one subscription exists
    const subscriptions = subscriber.getSubscriptions();
    const publicationSubscriptions = subscriptions.filter(
      (sub) => sub.publicationId === publication.publicationId,
    );
    expect(publicationSubscriptions.length).toBe(1);
  });
});
