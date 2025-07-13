import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "../../client/src/index.js";
import { SERVER_URL, setupTrickleIce } from "./fixture.js";

describe("Audio Publication - Cross-client media communication", () => {
  let client1: Client;
  let client2: Client;
  let roomId: string;
  let memberId1: string;
  let memberId2: string;

  beforeAll(async () => {
    // Create a room
    const createResponse = await fetch(`${SERVER_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const createResult = await createResponse.json();
    roomId = createResult.roomId;
  });

  afterAll(async () => {
    // Clean up
    if (client1) client1.close();
    if (client2) client2.close();

    // Leave room for both members if they exist
    if (memberId1) {
      await fetch(`${SERVER_URL}/members/${memberId1}/leave`, {
        method: "POST",
      });
    }
    if (memberId2) {
      await fetch(`${SERVER_URL}/members/${memberId2}/leave`, {
        method: "POST",
      });
    }
  });

  it("should publish audio track successfully", async () => {
    // Join the room
    const joinResponse = await fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const joinResult = await joinResponse.json();
    memberId1 = joinResult.memberId;

    client1 = await Client.create(joinResult.offer, memberId1);
    setupTrickleIce(client1, memberId1);
    const answer = await client1.createAndSetAnswer();

    await fetch(`${SERVER_URL}/members/${memberId1}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });

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
    // Setup both clients
    const [joinResult1, joinResult2] = await Promise.all([
      fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json()),
      fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json()),
    ]);

    memberId1 = joinResult1.memberId;
    memberId2 = joinResult2.memberId;

    client1 = await Client.create(joinResult1.offer, memberId1);
    client2 = await Client.create(joinResult2.offer, memberId2);

    setupTrickleIce(client1, memberId1);
    setupTrickleIce(client2, memberId2);

    const [answer1, answer2] = await Promise.all([
      client1.createAndSetAnswer(),
      client2.createAndSetAnswer(),
    ]);

    await Promise.all([
      fetch(`${SERVER_URL}/members/${memberId1}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer1 }),
      }),
      fetch(`${SERVER_URL}/members/${memberId2}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer2 }),
      }),
    ]);

    await Promise.all([
      client1.onConnected.asPromise(10000),
      client2.onConnected.asPromise(10000),
    ]);

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
    const [joinResult1, joinResult2] = await Promise.all([
      fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json()),
      fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then((res) => res.json()),
    ]);

    memberId1 = joinResult1.memberId;
    memberId2 = joinResult2.memberId;

    client1 = await Client.create(joinResult1.offer, memberId1);
    client2 = await Client.create(joinResult2.offer, memberId2);

    setupTrickleIce(client1, memberId1);
    setupTrickleIce(client2, memberId2);

    const [answer1, answer2] = await Promise.all([
      client1.createAndSetAnswer(),
      client2.createAndSetAnswer(),
    ]);

    await Promise.all([
      fetch(`${SERVER_URL}/members/${memberId1}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer1 }),
      }),
      fetch(`${SERVER_URL}/members/${memberId2}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer2 }),
      }),
    ]);

    await Promise.all([
      client1.onConnected.asPromise(10000),
      client2.onConnected.asPromise(10000),
    ]);

    let receivedPublicationId: string | null = null;
    const mediaPublicationPromise = new Promise<void>((resolve) => {
      client1.onMediaPublicationReady.subscribe((publicationId) => {
        receivedPublicationId = publicationId;
        resolve();
      });
    });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const publication = await client2.publishMedia(stream.getAudioTracks()[0]);

    await mediaPublicationPromise;

    expect(receivedPublicationId).toBe(publication.publicationId);

    stream.getTracks().forEach((track) => track.stop());
  });
});
