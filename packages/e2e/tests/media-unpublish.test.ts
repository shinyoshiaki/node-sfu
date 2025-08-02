import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "../../client/src/index.js";
import {
  cleanupClients,
  createRoom,
  setupMultipleClients,
  waitForConnections,
} from "./fixture.js";

describe("Media Unpublish - Cross-client media unpublish communication", () => {
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

  it("should unpublish audio track and notify remote clients", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Setup listener for publication ready event on client2
    let receivedRemotePublication: any = null;
    const mediaPublicationPromise = new Promise<void>((resolve) => {
      client2.onMediaPublicationReady.subscribe((remotePublication) => {
        receivedRemotePublication = remotePublication;
        resolve();
      });
    });

    // Client1 publishes audio
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioTrack = stream.getAudioTracks()[0];
    const publication = await client1.publishMedia(audioTrack);

    // Client2 should receive the publication ready event
    await mediaPublicationPromise;
    expect(receivedRemotePublication.id).toBe(publication.publicationId);
    expect(receivedRemotePublication.type).toBe("audio");

    // Setup listener for unpublish event on client2
    let unpublishedPublicationId: string | null = null;
    client2.onMediaUnpublished.subscribe((publicationId) => {
      unpublishedPublicationId = publicationId;
    });

    const unpublishPromise = client1.unpublishMedia(publication.publicationId);

    await Promise.all([
      unpublishPromise,
      client2.onMediaUnpublished.asPromise(10000),
    ]);
    expect(unpublishedPublicationId).toBe(publication.publicationId);

    // Verify the publication is removed from client1
    expect(
      client1.getMediaPublication(publication.publicationId),
    ).toBeUndefined();

    stream.getTracks().forEach((track) => track.stop());
  });

  it("should handle unpublish of video tracks", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Setup listener for publication ready event on client2
    let receivedRemotePublication: any = null;
    const mediaPublicationPromise = new Promise<void>((resolve) => {
      client2.onMediaPublicationReady.subscribe((remotePublication) => {
        receivedRemotePublication = remotePublication;
        resolve();
      });
    });

    // Client1 publishes video
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = stream.getVideoTracks()[0];
    const publication = await client1.publishMedia(videoTrack);

    // Client2 should receive the publication ready event
    await mediaPublicationPromise;
    expect(receivedRemotePublication.id).toBe(publication.publicationId);
    expect(receivedRemotePublication.type).toBe("video");

    // Setup listener for unpublish event on client2
    let unpublishedPublicationId: string | null = null;
    client2.onMediaUnpublished.subscribe((publicationId) => {
      unpublishedPublicationId = publicationId;
    });

    const unpublishPromise = client1.unpublishMedia(publication.publicationId);

    await Promise.all([
      unpublishPromise,
      client2.onMediaUnpublished.asPromise(10000),
    ]);
    expect(unpublishedPublicationId).toBe(publication.publicationId);

    // Verify the publication is removed from client1
    expect(
      client1.getMediaPublication(publication.publicationId),
    ).toBeUndefined();

    stream.getTracks().forEach((track) => track.stop());
  });

  it("should handle unpublish with multiple media tracks", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Client1 publishes both audio and video (sequentially to avoid WebRTC state conflicts)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    // Setup listener for publication ready events on client2
    const remotePublications: any[] = [];
    const publicationPromise = new Promise<void>((resolve) => {
      let count = 0;
      client2.onMediaPublicationReady.subscribe((remotePublication) => {
        remotePublications.push(remotePublication);
        count++;
        if (count === 2) resolve();
      });
    });

    // Publish audio first, then video
    const audioPublication = await client1.publishMedia(audioTrack);
    const videoPublication = await client1.publishMedia(videoTrack);

    // Wait for both publication ready events
    await publicationPromise;
    expect(remotePublications).toHaveLength(2);

    // Setup listener for unpublish events on client2
    const unpublishedPublicationIds: string[] = [];
    client2.onMediaUnpublished.subscribe((publicationId) => {
      unpublishedPublicationIds.push(publicationId);
    });

    {
      // Client1 unpublishes audio first
      const unpublishPromise = client1.unpublishMedia(
        audioPublication.publicationId,
      );

      // Wait for first unpublish event
      await Promise.all([
        unpublishPromise,
        client2.onMediaUnpublished.watch(
          (publicationId) => publicationId === audioPublication.publicationId,
          10000,
        ),
      ]);
    }

    expect(unpublishedPublicationIds).toContain(audioPublication.publicationId);
    expect(
      client1.getMediaPublication(audioPublication.publicationId),
    ).toBeUndefined();
    expect(
      client1.getMediaPublication(videoPublication.publicationId),
    ).toBeDefined();

    // Client1 unpublishes video
    const unpublishPromise = client1.unpublishMedia(
      videoPublication.publicationId,
    );

    // Wait for second unpublish event
    await Promise.all([
      unpublishPromise,
      client2.onMediaUnpublished.watch(
        (publicationId) => publicationId === videoPublication.publicationId,
        10000,
      ),
    ]);
    expect(unpublishedPublicationIds).toContain(videoPublication.publicationId);
    expect(unpublishedPublicationIds).toHaveLength(2);
    expect(
      client1.getMediaPublication(videoPublication.publicationId),
    ).toBeUndefined();

    stream.getTracks().forEach((track) => track.stop());
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
        client2.onMediaPublicationReady.subscribe(() => {
          client2ReceivedPublication = true;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        client3.onMediaPublicationReady.subscribe(() => {
          client3ReceivedPublication = true;
          resolve();
        });
      }),
    ]);

    // Client1 publishes audio
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioTrack = stream.getAudioTracks()[0];
    const publication = await client1.publishMedia(audioTrack);

    // Both client2 and client3 should receive the publication ready event
    await publicationPromise;

    // Setup listeners for unpublish events on both clients
    let client2UnpublishedId: string | null = null;
    let client3UnpublishedId: string | null = null;

    client2.onMediaUnpublished.subscribe((publicationId) => {
      client2UnpublishedId = publicationId;
    });

    client3.onMediaUnpublished.subscribe((publicationId) => {
      client3UnpublishedId = publicationId;
    });

    // Client1 unpublishes the audio
    const unpublishPromise = client1.unpublishMedia(publication.publicationId);

    // Both client2 and client3 should receive the unpublish event
    await Promise.all([
      client2.onMediaUnpublished.asPromise(10000),
      client3.onMediaUnpublished.asPromise(10000),
      unpublishPromise,
    ]);

    expect(client2UnpublishedId).toBe(publication.publicationId);
    expect(client3UnpublishedId).toBe(publication.publicationId);

    stream.getTracks().forEach((track) => track.stop());
    cleanupClients([client3]);
  });
});
