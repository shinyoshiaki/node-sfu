import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createAudioTrack,
  createDualClientSetup,
  createVideoTrack,
} from "./test-utils.js";

describe("Media publication and subscription", () => {
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

  it("should create and retrieve media publications", async () => {
    const audioTrack = createAudioTrack();
    const publication = await client.publishMedia(audioTrack);

    expect(publication).toBeDefined();
    expect(publication.track).toBe(audioTrack);

    const retrieved = client.getMediaPublication(publication.publicationId);
    expect(retrieved).toBe(publication);
  });

  it("should manage multiple media publications", async () => {
    const audioTrack = createAudioTrack();
    const videoTrack = createVideoTrack();

    const audioPub = await client.publishMedia(audioTrack);
    const videoPub = await client.publishMedia(videoTrack);

    const publications = client.getMediaPublications();
    expect(publications).toHaveLength(2);
    expect(publications).toContain(audioPub);
    expect(publications).toContain(videoPub);
  });

  it("should create media publication with metadata", async () => {
    const audioTrack = createAudioTrack();
    const metadata = {
      name: "main-audio",
      source: "microphone",
      quality: "high",
    };
    const publication = await client.publishMedia(audioTrack, metadata);

    expect(publication).toBeDefined();
    expect(publication.track).toBe(audioTrack);
    expect(publication.metadata).toEqual(metadata);
  });

  it("should receive remote media publication with metadata", async () => {
    const audioTrack = createAudioTrack();
    const metadata = {
      name: "remote-audio",
      source: "microphone",
      quality: "medium",
      channel: "stereo",
    };

    // Set up the promise before publishing to ensure we don't miss the event
    const remotePublicationPromise =
      client2.onMediaPublicationReady.asPromise(10000);

    const publication = await client.publishMedia(audioTrack, metadata);

    // Wait for the remote media publication to be received by client2
    const [remotePublication] = await remotePublicationPromise;

    expect(remotePublication).toBeDefined();
    expect(remotePublication.id).toBe(publication.publicationId);
    expect(remotePublication.publisher).toBe(client.id);
    expect(remotePublication.type).toBe("audio");
    expect(remotePublication.metadata).toEqual(metadata);
  });

  it("should create media subscriptions", async () => {
    const audioTrack = createAudioTrack();
    const publication = await client.publishMedia(audioTrack);
    const subscription = await client2.subscribeMedia(
      publication.publicationId,
    );

    expect(subscription).toBeDefined();
    expect(subscription.track).toBeDefined();
    expect(subscription.transceiver).toBeDefined();
    expect(subscription.track?.kind).toBe("audio");
  });

  it("should manage multiple media subscriptions", async () => {
    const audioTrack1 = createAudioTrack();
    const audioTrack2 = createAudioTrack();

    const pub1 = await client.publishMedia(audioTrack1);
    const pub2 = await client.publishMedia(audioTrack2);

    await client2.subscribeMedia(pub1.publicationId);
    await client2.subscribeMedia(pub2.publicationId);

    const subscriptions = client2.getMediaSubscriptions();
    expect(subscriptions).toHaveLength(2);
  });

  it("should unpublish media correctly", async () => {
    const audioTrack = createAudioTrack();
    const publication = await client.publishMedia(audioTrack);

    // Verify publication exists
    expect(client.getMediaPublication(publication.publicationId)).toBe(
      publication,
    );
    expect(client.getMediaPublications()).toHaveLength(1);

    // Unpublish the media
    await client.unpublishMedia(publication.publicationId);

    // Verify publication is removed
    expect(
      client.getMediaPublication(publication.publicationId),
    ).toBeUndefined();
    expect(client.getMediaPublications()).toHaveLength(0);
  });

  it("should handle unpublishing non-existent media", async () => {
    const nonExistentId = "non-existent-publication-id";

    await expect(client.unpublishMedia(nonExistentId)).rejects.toThrow(
      `Media publication ${nonExistentId} not found`,
    );
  });

  it("should stop track when unpublishing media", async () => {
    const audioTrack = createAudioTrack();
    let trackStopped = false;

    // Mock the stop method to track if it's called
    audioTrack.stop = () => {
      trackStopped = true;
    };

    const publication = await client.publishMedia(audioTrack);
    await client.unpublishMedia(publication.publicationId);

    // Verify the track was stopped
    expect(trackStopped).toBe(true);
  });

  it("should handle unpublishing multiple media publications", async () => {
    const audioTrack = createAudioTrack();
    const videoTrack = createVideoTrack();

    const audioPub = await client.publishMedia(audioTrack);
    const videoPub = await client.publishMedia(videoTrack);

    expect(client.getMediaPublications()).toHaveLength(2);

    // Unpublish audio first
    await client.unpublishMedia(audioPub.publicationId);
    expect(client.getMediaPublications()).toHaveLength(1);
    expect(client.getMediaPublication(audioPub.publicationId)).toBeUndefined();
    expect(client.getMediaPublication(videoPub.publicationId)).toBe(videoPub);

    // Unpublish video
    await client.unpublishMedia(videoPub.publicationId);
    expect(client.getMediaPublications()).toHaveLength(0);
    expect(client.getMediaPublication(videoPub.publicationId)).toBeUndefined();
  });

  it("should notify remote clients when media is unpublished", async () => {
    const audioTrack = createAudioTrack();
    const publication = await client.publishMedia(audioTrack);

    // Set up listener for unpublish events on client2
    let unpublishedPublicationId: string | null = null;
    client2.onMediaUnpublished.subscribe((publicationId) => {
      unpublishedPublicationId = publicationId;
    });

    // Unpublish from client
    client.unpublishMedia(publication.publicationId);

    // Wait for the unpublish event to be received by client2
    await client2.onMediaUnpublished.asPromise(
      5000,
      "Wait for unpublish event",
    );

    // Verify the event was received
    expect(unpublishedPublicationId).toBe(publication.publicationId);
  });
});
