import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "../../client/src/index.js";
import { SERVER_URL, setupTrickleIce } from "./fixture.js";

describe("DataChannel Pub-Sub - Cross-client data communication", () => {
  let publisher: Client;
  let subscriber: Client;
  let roomId: string;
  let publisherMemberId: string;
  let subscriberMemberId: string;

  beforeAll(async () => {
    // Create a room
    const createResponse = await fetch(`${SERVER_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const createResult = await createResponse.json();
    roomId = createResult.roomId;

    // Join the room with publisher
    const publisherJoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const publisherJoinResult = await publisherJoinResponse.json();
    publisherMemberId = publisherJoinResult.memberId;
    const publisherOffer = publisherJoinResult.offer;

    // Create publisher client
    publisher = await Client.create(publisherOffer, publisherMemberId);
    setupTrickleIce(publisher, publisherMemberId);
    const publisherAnswer = await publisher.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${publisherMemberId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: publisherAnswer }),
    });

    // Join the room with subscriber
    const subscriberJoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const subscriberJoinResult = await subscriberJoinResponse.json();
    subscriberMemberId = subscriberJoinResult.memberId;
    const subscriberOffer = subscriberJoinResult.offer;

    // Create subscriber client
    subscriber = await Client.create(subscriberOffer, subscriberMemberId);
    setupTrickleIce(subscriber, subscriberMemberId);
    const subscriberAnswer = await subscriber.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${subscriberMemberId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: subscriberAnswer }),
    });

    // Wait for both clients to connect
    await Promise.all([
      publisher.onConnected.asPromise(10000),
      subscriber.onConnected.asPromise(10000),
    ]);

    // Wait for control channels to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (publisherMemberId) {
      await fetch(`${SERVER_URL}/members/${publisherMemberId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    }
    if (subscriberMemberId) {
      await fetch(`${SERVER_URL}/members/${subscriberMemberId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    }
    if (publisher) {
      publisher.close();
    }
    if (subscriber) {
      subscriber.close();
    }
  });

  it("should notify all participants when publication is created", async () => {
    const publication = await publisher.publish();

    // Subscriber should receive publication ready notification
    await subscriber.onPublicationReady.watch(
      (publicationId) => publicationId === publication.publicationId,
      10000,
    );

    expect(publication.publicationId).toBeTruthy();
  });

  it("should allow subscription to published data", async () => {
    const publication = await publisher.publish();

    await subscriber.subscribe(publication.publicationId);

    const subscription = subscriber.getSubscription(publication.publicationId);
    expect(subscription).toBeTruthy();
    expect(subscription!.publicationId).toBe(publication.publicationId);
  });

  it("should relay messages between publisher and subscriber", async () => {
    const publication = await publisher.publish();
    await subscriber.subscribe(publication.publicationId);

    const subscription = subscriber.getSubscription(publication.publicationId)!;

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
    // Create second subscriber
    const subscriber2JoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const { memberId: subscriber2MemberId, offer: subscriber2Offer } =
      await subscriber2JoinResponse.json();

    const subscriber2 = await Client.create(
      subscriber2Offer,
      subscriber2MemberId,
    );
    setupTrickleIce(subscriber2, subscriber2MemberId);
    const subscriber2Answer = await subscriber2.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${subscriber2MemberId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: subscriber2Answer }),
    });

    try {
      const publication = await publisher.publish();

      await subscriber.subscribe(publication.publicationId);
      await subscriber2.subscribe(publication.publicationId);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const receivedMessages1: string[] = [];
      const receivedMessages2: string[] = [];

      subscriber
        .getSubscription(publication.publicationId)!
        .onMessage.subscribe((data) => {
          receivedMessages1.push(data as string);
        });
      subscriber2
        .getSubscription(publication.publicationId)!
        .onMessage.subscribe((data) => {
          receivedMessages2.push(data as string);
        });

      const testMessage = "Broadcast message";
      publication.send(testMessage);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(receivedMessages1).toContain(testMessage);
      expect(receivedMessages2).toContain(testMessage);
    } finally {
      await fetch(`${SERVER_URL}/members/${subscriber2MemberId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      subscriber2.close();
    }
  });
});
