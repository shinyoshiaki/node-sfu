import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "../../client/src/index.js";
import {
  cleanupClients,
  createRoom,
  setupMultipleClients,
  waitForConnections,
} from "./fixture.js";

describe("Data Unpublish - Cross-client data unpublish communication", () => {
  let client1: Client;
  let client2: Client;
  let roomId: string;
  let memberId1: string;
  let memberId2: string;

  beforeAll(async () => {
    roomId = await createRoom();
  });

  afterAll(async () => {
    cleanupClients([client1, client2]);
  });

  it("should unpublish data channel and notify remote clients", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Setup listener for publication ready event on client2
    let receivedRemotePublication: any = null;
    const dataPublicationPromise = new Promise<void>((resolve) => {
      client2.onPublicationReady.subscribe((remotePublication) => {
        receivedRemotePublication = remotePublication;
        resolve();
      });
    });

    // Client1 publishes data
    const publication = await client1.publishData();

    // Client2 should receive the publication ready event
    await dataPublicationPromise;
    expect(receivedRemotePublication.id).toBe(publication.publicationId);
    expect(receivedRemotePublication.type).toBe("data");

    // Setup listener for unpublish event on client2
    let unpublishedPublicationId: string | null = null;
    client2.onDataUnpublished.subscribe((publicationId) => {
      unpublishedPublicationId = publicationId;
    });

    const unpublishPromise = client1.unpublishData(publication.publicationId);

    await Promise.all([
      unpublishPromise,
      client2.onDataUnpublished.asPromise(10000),
    ]);
    expect(unpublishedPublicationId).toBe(publication.publicationId);

    // Verify the publication is removed from client1
    expect(client1.getPublication(publication.publicationId)).toBeUndefined();
  });

  it("should handle unpublish with multiple data publications", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Setup listener for publication ready events on client2
    const remotePublications: any[] = [];
    const publicationPromise = new Promise<void>((resolve) => {
      let count = 0;
      client2.onPublicationReady.subscribe((remotePublication) => {
        remotePublications.push(remotePublication);
        count++;
        if (count === 2) resolve();
      });
    });

    // Client1 publishes two data channels
    const publication1 = await client1.publishData();
    const publication2 = await client1.publishData();

    // Wait for both publication ready events
    await publicationPromise;
    expect(remotePublications).toHaveLength(2);

    // Setup listener for unpublish events on client2
    const unpublishedPublicationIds: string[] = [];
    client2.onDataUnpublished.subscribe((publicationId) => {
      unpublishedPublicationIds.push(publicationId);
    });

    {
      // Client1 unpublishes first data channel
      const unpublishPromise = client1.unpublishData(
        publication1.publicationId,
      );

      // Wait for first unpublish event
      await Promise.all([
        unpublishPromise,
        client2.onDataUnpublished.watch(
          (publicationId) => publicationId === publication1.publicationId,
          10000,
        ),
      ]);
    }

    expect(unpublishedPublicationIds).toContain(publication1.publicationId);
    expect(client1.getPublication(publication1.publicationId)).toBeUndefined();
    expect(client1.getPublication(publication2.publicationId)).toBeDefined();

    // Client1 unpublishes second data channel
    const unpublishPromise = client1.unpublishData(publication2.publicationId);

    // Wait for second unpublish event
    await Promise.all([
      unpublishPromise,
      client2.onDataUnpublished.watch(
        (publicationId) => publicationId === publication2.publicationId,
        10000,
      ),
    ]);
    expect(unpublishedPublicationIds).toContain(publication2.publicationId);
    expect(unpublishedPublicationIds).toHaveLength(2);
    expect(client1.getPublication(publication2.publicationId)).toBeUndefined();
  });

  it("should handle unpublish when multiple clients are present", async () => {
    const [client1Setup, client2Setup, client3Setup] =
      await setupMultipleClients(roomId, 3);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;
    const client3 = client3Setup.client;

    await waitForConnections([client1, client2, client3]);

    // Setup listeners for publication ready events
    let client2ReceivedPublication = false;
    let client3ReceivedPublication = false;
    const publicationPromise = Promise.all([
      new Promise<void>((resolve) => {
        client2.onPublicationReady.subscribe(() => {
          client2ReceivedPublication = true;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        client3.onPublicationReady.subscribe(() => {
          client3ReceivedPublication = true;
          resolve();
        });
      }),
    ]);

    // Client1 publishes data
    const publication = await client1.publishData();

    // Both client2 and client3 should receive the publication ready event
    await publicationPromise;

    // Setup listeners for unpublish events on both clients
    let client2UnpublishedId: string | null = null;
    let client3UnpublishedId: string | null = null;

    client2.onDataUnpublished.subscribe((publicationId) => {
      client2UnpublishedId = publicationId;
    });

    client3.onDataUnpublished.subscribe((publicationId) => {
      client3UnpublishedId = publicationId;
    });

    // Client1 unpublishes the data
    const unpublishPromise = client1.unpublishData(publication.publicationId);

    // Both client2 and client3 should receive the unpublish event
    await Promise.all([
      client2.onDataUnpublished.asPromise(10000),
      client3.onDataUnpublished.asPromise(10000),
      unpublishPromise,
    ]);

    expect(client2UnpublishedId).toBe(publication.publicationId);
    expect(client3UnpublishedId).toBe(publication.publicationId);

    cleanupClients([client3]);
  });

  it("should handle data transmission and unpublish", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Setup listener for publication ready event on client2
    let subscription: any = null;
    const dataPublicationPromise = new Promise<void>((resolve) => {
      client2.onPublicationReady.subscribe(async (remotePublication) => {
        subscription = await client2.subscribeData(remotePublication.id);
        resolve();
      });
    });

    // Client1 publishes data
    const publication = await client1.publishData();

    // Client2 should receive the publication ready event and subscribe
    await dataPublicationPromise;
    expect(subscription).toBeDefined();

    // Test data transmission
    const testMessage = "Hello, World!";
    let receivedMessage: string | null = null;
    const messagePromise = new Promise<void>((resolve) => {
      subscription.onMessage.subscribe((message: string) => {
        receivedMessage = message;
        resolve();
      });
    });

    publication.send(testMessage);
    await messagePromise;
    expect(receivedMessage).toBe(testMessage);

    // Setup listener for unpublish event on client2
    let unpublishedPublicationId: string | null = null;
    client2.onDataUnpublished.subscribe((publicationId) => {
      unpublishedPublicationId = publicationId;
    });

    // Client1 unpublishes the data
    const unpublishPromise = client1.unpublishData(publication.publicationId);

    await Promise.all([
      unpublishPromise,
      client2.onDataUnpublished.asPromise(10000),
    ]);
    expect(unpublishedPublicationId).toBe(publication.publicationId);

    // Verify the publication is removed from client1
    expect(client1.getPublication(publication.publicationId)).toBeUndefined();
  });
});
