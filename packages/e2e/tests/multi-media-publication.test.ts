import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "../../client/src/index.js";
import {
  cleanupClients,
  createRoom,
  setupMultipleClients,
  waitForConnections,
} from "./fixture.js";

describe("Multiple Media Publication and Subscription - Cross-client communication", () => {
  let client1: Client; // Publisher
  let client2: Client; // Subscriber
  let roomId: string;
  let memberId1: string;
  let memberId2: string;

  beforeAll(async () => {
    roomId = await createRoom();
  });

  afterAll(async () => {
    cleanupClients([client1, client2]);
  });

  /**
   * WebRTC Statistics を使用してRTPパケット受信を確認するヘルパー関数
   */
  async function waitForRTPPackets(
    client: Client,
    subscriptionId: string,
    timeout: number = 10000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const subscription = client.getMediaSubscription(subscriptionId);

        if (!subscription?.transceiver) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        const stats = await subscription.transceiver.receiver.getStats();

        // Check for inbound-rtp stats with packets received
        for (const [, stat] of stats) {
          if (
            stat.type === "inbound-rtp" &&
            stat.packetsReceived &&
            stat.packetsReceived > 0
          ) {
            console.log(
              `RTP packets received for subscription ${subscriptionId}: ${JSON.stringify(stat, null, 2)}`,
            );
            return; // RTP packets received successfully
          }
        }
      } catch (error) {
        // Continue checking if stats not available yet
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`RTP packets not received within ${timeout}ms`);
  }

  it(
    "should publish multiple media with different metadata and receive RTP packets",
    { timeout: 30000 },
    async () => {
      // 1. Setup dual clients
      const [client1Setup, client2Setup] = await setupMultipleClients(
        roomId,
        2,
      );
      client1 = client1Setup.client;
      memberId1 = client1Setup.memberId;
      client2 = client2Setup.client;
      memberId2 = client2Setup.memberId;

      // 2. Metadata definitions
      const cameraMetadata = {
        source: "camera",
        deviceType: "webcam",
        resolution: "1080p",
      };

      const screenShareMetadata = {
        source: "screen",
        deviceType: "display",
        captureType: "screen",
      };

      for (const [sender, receiver] of [
        [client1, client2],
        [client2, client1],
      ]) {
        // 3. Setup publication ready listeners
        const cameraPublicationPromise =
          receiver.onMediaPublicationReady.asPromise(10000);

        // 4. Create camera video track and publish
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        const cameraTrack = cameraStream.getVideoTracks()[0];

        const cameraPub = await sender.publishMedia(
          cameraTrack,
          cameraMetadata,
        );
        expect(cameraPub).toBeDefined();
        expect(cameraPub.metadata).toEqual(cameraMetadata);

        // 5. Verify camera remote publication received
        const [cameraRemotePublication] = await cameraPublicationPromise;
        expect(cameraRemotePublication).toBeDefined();
        expect(cameraRemotePublication.metadata).toEqual(cameraMetadata);
        expect(cameraRemotePublication.id).toBe(cameraPub.publicationId);

        const cameraSubscription = await receiver.subscribeMedia(
          cameraPub.publicationId,
        );

        // 6. Setup screen share publication listener
        const screenPublicationPromise =
          receiver.onMediaPublicationReady.asPromise(10000);

        // 7. Create screen share video track and publish
        const screenStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        const screenPub = await sender.publishMedia(
          screenTrack,
          screenShareMetadata,
        );
        expect(screenPub).toBeDefined();
        expect(screenPub.metadata).toEqual(screenShareMetadata);

        // 8. Verify screen share remote publication received
        const [screenRemotePublication] = await screenPublicationPromise;
        expect(screenRemotePublication).toBeDefined();
        expect(screenRemotePublication.metadata).toEqual(screenShareMetadata);
        expect(screenRemotePublication.id).toBe(screenPub.publicationId);

        const screenSubscription = await receiver.subscribeMedia(
          screenPub.publicationId,
        );

        // 11. Verify RTP packet reception using WebRTC Statistics
        await Promise.all([
          waitForRTPPackets(receiver, cameraSubscription.subscriptionId),
          waitForRTPPackets(receiver, screenSubscription.subscriptionId),
        ]);
      }
    },
  );

  it(
    "should handle multiple media publications from different clients",
    { timeout: 30000 },
    async () => {
      // Setup three clients: client1 and client2 as publishers, client3 as subscriber
      const [client1Setup, client2Setup, client3Setup] =
        await setupMultipleClients(roomId, 3);
      client1 = client1Setup.client;
      client2 = client2Setup.client;
      const client3 = client3Setup.client;

      await waitForConnections([client1, client2, client3]);

      // Metadata for different sources
      const client1Metadata = { publisher: "client1", source: "camera" };
      const client2Metadata = { publisher: "client2", source: "screen" };

      // Setup publication listeners on client3
      const publications: any[] = [];
      const publicationPromise = new Promise<void>((resolve) => {
        let count = 0;
        client3.onMediaPublicationReady.subscribe((remotePublication) => {
          publications.push(remotePublication);
          count++;
          if (count === 2) resolve();
        });
      });

      // Client1 and Client2 publish media simultaneously
      const [stream1, stream2] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: true }),
        navigator.mediaDevices.getUserMedia({ video: true }),
      ]);

      const [pub1, pub2] = await Promise.all([
        client1.publishMedia(stream1.getVideoTracks()[0], client1Metadata),
        client2.publishMedia(stream2.getVideoTracks()[0], client2Metadata),
      ]);

      // Wait for both publications to be received
      await publicationPromise;
      expect(publications).toHaveLength(2);

      // Subscribe to both publications from client3
      const [sub1, sub2] = await Promise.all([
        client3.subscribeMedia(pub1.publicationId),
        client3.subscribeMedia(pub2.publicationId),
      ]);

      // Verify subscriptions
      expect(sub1.track!.kind).toBe("video");
      expect(sub2.track!.kind).toBe("video");

      // Verify RTP packets are received for both subscriptions
      await Promise.all([
        waitForRTPPackets(client3, sub1.subscriptionId),
        waitForRTPPackets(client3, sub2.subscriptionId),
      ]);

      // Verify metadata is preserved
      const pub1Remote = publications.find((p) => p.id === pub1.publicationId);
      const pub2Remote = publications.find((p) => p.id === pub2.publicationId);

      expect(pub1Remote.metadata).toEqual(client1Metadata);
      expect(pub2Remote.metadata).toEqual(client2Metadata);

      // Cleanup
      stream1.getTracks().forEach((track) => track.stop());
      stream2.getTracks().forEach((track) => track.stop());
      cleanupClients([client3]);
    },
  );

  it(
    "should support audio and video publications simultaneously",
    { timeout: 30000 },
    async () => {
      const [client1Setup, client2Setup] = await setupMultipleClients(
        roomId,
        2,
      );
      client1 = client1Setup.client;
      client2 = client2Setup.client;

      await waitForConnections([client1, client2]);

      // Get both audio and video tracks
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      // Setup publication listeners
      const publications: any[] = [];
      const publicationPromise = new Promise<void>((resolve) => {
        let count = 0;
        client2.onMediaPublicationReady.subscribe((remotePublication) => {
          publications.push(remotePublication);
          count++;
          if (count === 2) resolve();
        });
      });

      // Publish both audio and video
      const [audioPub, videoPub] = await Promise.all([
        client1.publishMedia(audioTrack, {
          type: "audio",
          source: "microphone",
        }),
        client1.publishMedia(videoTrack, { type: "video", source: "camera" }),
      ]);

      // Wait for both publications to be received
      await publicationPromise;
      expect(publications).toHaveLength(2);

      // Subscribe to both
      const [audioSub, videoSub] = await Promise.all([
        client2.subscribeMedia(audioPub.publicationId),
        client2.subscribeMedia(videoPub.publicationId),
      ]);

      // Verify track kinds
      expect(audioSub.track!.kind).toBe("audio");
      expect(videoSub.track!.kind).toBe("video");

      // Verify RTP packets for both tracks
      await Promise.all([
        waitForRTPPackets(client2, audioSub.subscriptionId),
        waitForRTPPackets(client2, videoSub.subscriptionId),
      ]);

      // Cleanup
      stream.getTracks().forEach((track) => track.stop());
    },
  );
});
