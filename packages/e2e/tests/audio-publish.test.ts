import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "../../client/src/index.js";
import {
  cleanupClients,
  createAndSetupClient,
  createRoom,
  setupMultipleClients,
  waitForConnections,
} from "./fixture.js";

describe("Audio Publication - Cross-client media communication", () => {
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

  it("should publish audio track successfully", async () => {
    const { client, memberId } = await createAndSetupClient(roomId);
    client1 = client;
    memberId1 = memberId;

    await client1.onConnected.asPromise(10000);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false },
    });
    const audioTrack = stream.getAudioTracks()[0];

    const publication = await client1.publishMedia(audioTrack);
    expect(publication).toBeDefined();
    expect(publication.track).toBe(audioTrack);

    audioTrack.stop();
    stream.getTracks().forEach((track) => track.stop());
  });

  it("should support multiple participants publishing audio", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    const [stream1, stream2] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ audio: true }),
      navigator.mediaDevices.getUserMedia({ audio: true }),
    ]);

    const [publication1, publication2] = await Promise.all([
      client1.publishMedia(stream1.getAudioTracks()[0]),
      client2.publishMedia(stream2.getAudioTracks()[0]),
    ]);

    expect(publication1.publicationId).not.toBe(publication2.publicationId);

    [stream1, stream2].forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
  });

  it("should notify other participants when audio is published", async () => {
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);
    client1 = client1Setup.client;
    memberId1 = client1Setup.memberId;
    client2 = client2Setup.client;
    memberId2 = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    let receivedRemotePublication: any = null;
    const mediaPublicationPromise = new Promise<void>((resolve) => {
      client1.onMediaPublicationReady.subscribe((remotePublication) => {
        receivedRemotePublication = remotePublication;
        resolve();
      });
    });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const publication = await client2.publishMedia(stream.getAudioTracks()[0]);

    await mediaPublicationPromise;

    expect(receivedRemotePublication.id).toBe(publication.publicationId);
    expect(receivedRemotePublication.type).toBe("audio");
    expect(receivedRemotePublication.publisher).toBe(memberId2);

    stream.getTracks().forEach((track) => track.stop());
  });
});
