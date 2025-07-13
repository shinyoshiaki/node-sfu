import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MediaStreamTrack,
  RTCPeerConnection,
  RtpHeader,
  RtpPacket,
} from "../../../submodules/werift/packages/webrtc/src/index.js";
import { type Member, type Room, createRoom } from "../../core/src/index.js";
import { Client } from "../src/index.js";

describe("Client API integration tests", () => {
  let room: Room;
  let client: Client;
  let client2: Client;
  let member: Member;
  let member2: Member;
  let peerConnection: RTCPeerConnection;

  beforeEach(async () => {
    // Create a room
    room = createRoom();

    // Setup client
    {
      const joinResult = await room.join();
      member = joinResult.member;
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      client = await Client.create(joinResult.offerSdp, member.memberId, {
        peerConnection,
      });
      const answer = await client.createAndSetAnswer();
      await member.accept(answer);
    }
    {
      const joinResult = await room.join();
      member2 = joinResult.member;
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      client2 = await Client.create(joinResult.offerSdp, member2.memberId, {
        peerConnection,
      });
      const answer = await client2.createAndSetAnswer();
      await member2.accept(answer);
    }
  });

  afterEach(async () => {
    // Cleanup
    if (client) client.close();
    if (client2) client2.close();
    if (peerConnection) peerConnection.close();
    if (member) room.removeMember(member.memberId);
    if (member2) room.removeMember(member2.memberId);
  });

  describe("Connection and client state", () => {
    it("should establish WebRTC connection", async () => {
      await client.onConnected.asPromise(10000);
      expect(client.isConnected()).toBe(true);
      expect(client.peerConnection.connectionState).toBe("connected");
    });

    it("should handle ICE candidate addition", async () => {
      const candidate = {
        candidate: "candidate:1 1 UDP 2122194687 192.168.1.1 54400 typ host",
        sdpMLineIndex: 0,
        sdpMid: "0",
      };

      await expect(client.addIceCandidate(candidate)).resolves.not.toThrow();
    });
  });

  describe("Data publication and subscription", () => {
    it("should create and retrieve data publications", async () => {
      const publication = await client.publish();

      expect(publication).toBeDefined();
      expect(publication.publicationId).toBeDefined();

      const retrieved = client.getPublication(publication.publicationId);
      expect(retrieved).toBe(publication);
    });

    it("should manage multiple publications", async () => {
      const pub1 = await client.publish();
      const pub2 = await client.publish();

      const publications = client.getPublications();
      expect(publications).toHaveLength(2);
      expect(publications).toContain(pub1);
      expect(publications).toContain(pub2);
    });

    it("should create and retrieve subscriptions", async () => {
      const publication = await client.publish();
      await client2.subscribe(publication.publicationId);

      const subscription = client2.getSubscription(publication.publicationId);
      expect(subscription).toBeDefined();
      expect(subscription?.publicationId).toBe(publication.publicationId);
    });

    it("should manage multiple subscriptions", async () => {
      const pub1 = await client.publish();
      const pub2 = await client.publish();

      await client.subscribe(pub1.publicationId);
      await client.subscribe(pub2.publicationId);

      const subscriptions = client.getSubscriptions();
      expect(subscriptions).toHaveLength(2);
    });
  });

  describe("Media publication and subscription", () => {
    it("should create and retrieve media publications", async () => {
      const audioTrack = new MediaStreamTrack({ kind: "audio" });
      const publication = await client.publishMedia(audioTrack);

      expect(publication).toBeDefined();
      expect(publication.track).toBe(audioTrack);

      const retrieved = client.getMediaPublication(publication.publicationId);
      expect(retrieved).toBe(publication);
    });

    it("should manage multiple media publications", async () => {
      const audioTrack = new MediaStreamTrack({ kind: "audio" });
      const videoTrack = new MediaStreamTrack({ kind: "video" });

      const audioPub = await client.publishMedia(audioTrack);
      const videoPub = await client.publishMedia(videoTrack);

      const publications = client.getMediaPublications();
      expect(publications).toHaveLength(2);
      expect(publications).toContain(audioPub);
      expect(publications).toContain(videoPub);
    });

    it("should create media subscriptions", async () => {
      const audioTrack = new MediaStreamTrack({ kind: "audio" });
      const publication = await client.publishMedia(audioTrack);
      const subscription = await client.subscribeMedia(
        publication.publicationId,
      );

      expect(subscription).toBeDefined();
      expect(subscription.track).toBeDefined();
      expect(subscription.transceiver).toBeDefined();
      expect(subscription.track?.kind).toBe("audio");
    });

    it("should manage multiple media subscriptions", async () => {
      const audioTrack1 = new MediaStreamTrack({ kind: "audio" });
      const audioTrack2 = new MediaStreamTrack({ kind: "audio" });

      const pub1 = await client.publishMedia(audioTrack1);
      const pub2 = await client.publishMedia(audioTrack2);

      await client.subscribeMedia(pub1.publicationId);
      await client.subscribeMedia(pub2.publicationId);

      const subscriptions = client.getMediaSubscriptions();
      expect(subscriptions).toHaveLength(2);
    });
  });

  describe("Client configuration", () => {
    it("should support custom peer connection injection", async () => {
      const customPeerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.custom.com:19302" }],
      });

      const joinResult = await room.join();
      const customClient = await Client.create(
        joinResult.offerSdp,
        joinResult.member.memberId,
        { peerConnection: customPeerConnection },
      );

      expect(customClient.peerConnection).toBe(customPeerConnection);

      // Cleanup
      customClient.close();
      room.removeMember(joinResult.member.memberId);
    });

    it("should support custom ICE servers", async () => {
      const customIceServers = [{ urls: "stun:stun.custom.com:19302" }];

      const joinResult = await room.join();
      // Create a PeerConnection with custom ICE servers and inject it
      const customPeerConnection = new RTCPeerConnection({
        iceServers: customIceServers,
      });
      const customClient = await Client.create(
        joinResult.offerSdp,
        joinResult.member.memberId,
        { peerConnection: customPeerConnection },
      );

      const config = customClient.peerConnection.getConfiguration();
      expect(config.iceServers).toEqual(customIceServers);

      // Cleanup
      customClient.close();
      room.removeMember(joinResult.member.memberId);
    });
  });

  describe("Client lifecycle", () => {
    it("should handle client close", async () => {
      const publication = await client.publish();
      const audioTrack = new MediaStreamTrack({ kind: "audio" });
      const mediaPublication = await client.publishMedia(audioTrack);

      expect(client.getPublications()).toHaveLength(1);
      expect(client.getMediaPublications()).toHaveLength(1);
      expect(client.isConnected()).toBe(true);

      // Close the client
      client.close();

      // Verify publications and subscriptions are cleared
      expect(client.getPublications()).toHaveLength(0);
      expect(client.getMediaPublications()).toHaveLength(0);
    });
  });

  describe("Member leave events", () => {
    it("should expose onMemberLeft event", () => {
      // Test that the event exists and is of correct type
      expect(client.onMemberLeft).toBeDefined();
      expect(typeof client.onMemberLeft.subscribe).toBe("function");
    });

    it("should receive member left event when another member leaves", async () => {
      // Setup - wait for both clients to connect
      await client.onConnected.asPromise(10000);
      await client2.onConnected.asPromise(10000);

      // Subscribe to member left event
      let leftMemberId: string | null = null;
      client.onMemberLeft.subscribe((memberId) => {
        leftMemberId = memberId;
      });

      // Get the second client's member ID
      const secondMemberId = member2.memberId;

      // Simulate member leaving by removing them from the room
      room.removeMember(secondMemberId);

      // Wait for the event to be fired
      await client.onMemberLeft.asPromise(5000);

      // Verify the event was received with correct member ID
      expect(leftMemberId).toBe(secondMemberId);
    });

    it("should receive member left event when multiple members leave", async () => {
      // Setup - create a third client
      const joinResult3 = await room.join();
      const peerConnection3 = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      const client3 = await Client.create(
        joinResult3.offerSdp,
        joinResult3.member.memberId,
        { peerConnection: peerConnection3 },
      );
      const answer3 = await client3.createAndSetAnswer();
      await joinResult3.member.accept(answer3);

      // Wait for all clients to connect
      await client.onConnected.asPromise(10000);
      await client2.onConnected.asPromise(10000);
      await client3.onConnected.asPromise(10000);

      // Track member left events
      const leftMemberIds: string[] = [];
      client.onMemberLeft.subscribe((memberId) => {
        leftMemberIds.push(memberId);
      });

      // Get member IDs
      const secondMemberId = member2.memberId;
      const thirdMemberId = joinResult3.member.memberId;

      // Remove both members
      room.removeMember(secondMemberId);
      room.removeMember(thirdMemberId);

      // Wait for both events (with timeout)
      await new Promise<void>((resolve) => {
        const checkEvents = () => {
          if (leftMemberIds.length >= 2) {
            resolve();
          } else {
            setTimeout(checkEvents, 100);
          }
        };
        setTimeout(() => resolve(), 5000); // Timeout after 5 seconds
        checkEvents();
      });

      // Verify both events were received
      expect(leftMemberIds).toContain(secondMemberId);
      expect(leftMemberIds).toContain(thirdMemberId);
      expect(leftMemberIds).toHaveLength(2);

      // Cleanup
      client3.close();
      peerConnection3.close();
    });
  });
});
