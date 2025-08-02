import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createDualClientSetup,
} from "./test-utils.js";

describe("Data publication and subscription", () => {
  let setup: DualClientSetup;
  let room: Room;
  let client: Client;
  let client2: Client;
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

  it("should create and retrieve data publications", async () => {
    const publication = await client.publishData();

    expect(publication).toBeDefined();
    expect(publication.publicationId).toBeDefined();

    const retrieved = client.getPublication(publication.publicationId);
    expect(retrieved).toBe(publication);
  });

  it("should manage multiple publications", async () => {
    const pub1 = await client.publishData();
    const pub2 = await client.publishData();

    const publications = client.getPublications();
    expect(publications).toHaveLength(2);
    expect(publications).toContain(pub1);
    expect(publications).toContain(pub2);
  });

  it("should create data publication with metadata", async () => {
    const metadata = {
      name: "test-channel",
      priority: "high",
      tags: ["urgent", "data"],
    };
    const publication = await client.publishData(metadata);

    expect(publication).toBeDefined();
    expect(publication.publicationId).toBeDefined();
    expect(publication.metadata).toEqual(metadata);
  });

  it("should receive remote data publication with metadata", async () => {
    const metadata = {
      name: "remote-channel",
      type: "broadcast",
      priority: "low",
    };

    // Set up the watch before publishing to ensure we don't miss the event
    const remotePublicationPromise =
      client2.onPublicationReady.asPromise(10000);

    const publication = await client.publishData(metadata);

    // Wait for the remote publication to be received by client2
    const [remotePublication] = await remotePublicationPromise;

    expect(remotePublication).toBeDefined();
    expect(remotePublication.id).toBe(publication.publicationId);
    expect(remotePublication.publisher).toBe(client.id);
    expect(remotePublication.type).toBe("data");
    expect(remotePublication.metadata).toEqual(metadata);
  });

  it("should create and retrieve subscriptions", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    expect(subscription).toBeDefined();
    expect(subscription.publicationId).toBe(publication.publicationId);
  });

  it("should manage multiple subscriptions", async () => {
    const pub1 = await client.publishData();
    const pub2 = await client.publishData();

    await client2.subscribeData(pub1.publicationId);
    await client2.subscribeData(pub2.publicationId);

    const subscriptions = client2.getSubscriptions();
    expect(subscriptions).toHaveLength(2);
  });

  it("should unpublish data publications", async () => {
    const publication = await client.publishData();

    expect(client.getPublication(publication.publicationId)).toBeDefined();

    await client.unpublishData(publication.publicationId);

    expect(client.getPublication(publication.publicationId)).toBeUndefined();
  });

  it("should fail to unpublish non-existent publication", async () => {
    const nonExistentId = "non-existent-publication-id";

    await expect(client.unpublishData(nonExistentId)).rejects.toThrow();
  });

  it("should notify other clients when data is unpublished", async () => {
    const publication = await client.publishData();

    // Set up the watch before unpublishing to ensure we don't miss the event
    const unpublishPromise = client2.onDataUnpublished.asPromise(10000);

    await client.unpublishData(publication.publicationId);

    // Wait for the unpublish notification
    const [unpublishedPublicationId] = await unpublishPromise;

    expect(unpublishedPublicationId).toBe(publication.publicationId);
  });

  it("should handle multiple data unpublish operations", async () => {
    const pub1 = await client.publishData();
    const pub2 = await client.publishData();

    expect(client.getPublications()).toHaveLength(2);

    await client.unpublishData(pub1.publicationId);
    expect(client.getPublications()).toHaveLength(1);
    expect(client.getPublication(pub1.publicationId)).toBeUndefined();
    expect(client.getPublication(pub2.publicationId)).toBeDefined();

    await client.unpublishData(pub2.publicationId);
    expect(client.getPublications()).toHaveLength(0);
    expect(client.getPublication(pub2.publicationId)).toBeUndefined();
  });

  it("should unsubscribe from data subscriptions", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    expect(client2.getSubscriptions()).toHaveLength(1);
    expect(client2.getSubscription(subscription.publicationId)).toBe(
      subscription,
    );

    await client2.unsubscribeData(subscription.publicationId);

    expect(client2.getSubscriptions()).toHaveLength(0);
    expect(client2.getSubscription(subscription.publicationId)).toBeUndefined();
  });

  it("should handle unsubscribing from non-existent subscription", async () => {
    const nonExistentId = "non-existent-subscription-id";

    await expect(client2.unsubscribeData(nonExistentId)).rejects.toThrow(
      `Data subscription ${nonExistentId} not found`,
    );
  });

  it("should manage data subscriptions correctly", async () => {
    const pub1 = await client.publishData();
    const pub2 = await client.publishData();

    const sub1 = await client2.subscribeData(pub1.publicationId);
    const sub2 = await client2.subscribeData(pub2.publicationId);

    const subscriptions = client2.getDataSubscriptions();
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions).toContain(sub1);
    expect(subscriptions).toContain(sub2);
  });

  it("should handle unpublishing with active subscriptions", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    expect(client2.getSubscriptions()).toHaveLength(1);

    const unsubscribePromise = client2.onDataUnsubscribed.asPromise(5000);

    await client.unpublishData(publication.publicationId);

    const [unsubscribedPublicationId] = await unsubscribePromise;
    expect(unsubscribedPublicationId).toBe(publication.publicationId);
    expect(client2.getSubscriptions()).toHaveLength(0);
  });

  it("should send and receive data messages", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    const messagePromise = subscription.onMessage.asPromise(5000);
    const testMessage = "Hello, World!";

    setTimeout(() => publication.send(testMessage));

    const [receivedMessage] = await messagePromise;
    expect(receivedMessage).toBe(testMessage);
  });

  it("should handle binary data messages", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    const messagePromise = subscription.onMessage.asPromise(5000);
    const binaryData = new Uint8Array([1, 2, 3, 4, 5]);

    setTimeout(() => publication.send(binaryData));

    const [receivedData] = await messagePromise;
    expect(new Uint8Array(receivedData as ArrayBuffer)).toEqual(binaryData);
  });

  it("should handle JSON data messages", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    const messagePromise = subscription.onMessage.asPromise(5000);
    const jsonData = { type: "test", value: 42, nested: { key: "value" } };

    publication.send(JSON.stringify(jsonData));

    const [receivedMessage] = await messagePromise;
    expect(JSON.parse(receivedMessage as string)).toEqual(jsonData);
  });

  it("should handle multiple message sending and receiving", async () => {
    const publication = await client.publishData();
    const subscription = await client2.subscribeData(publication.publicationId);

    const messages = ["message1", "message2", "message3"];
    const receivedMessages: string[] = [];

    subscription.onMessage.subscribe((message) => {
      receivedMessages.push(message as string);
    });

    for (const message of messages) {
      publication.send(message);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(receivedMessages).toEqual(messages);
  });
});
