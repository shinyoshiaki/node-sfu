import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RTCPeerConnection } from "../../../submodules/werift/packages/webrtc/src/index.js";
import { createRoom } from "../../core/src/index.js";
import { Client } from "../src/index.js";

describe("Member metadata and name", () => {
  it("should handle member joined events with name and metadata", async () => {
    // Create room
    const room = createRoom();

    // First client joins with name and metadata
    const joinResult1 = await room.join({
      name: "Alice",
      metadata: { role: "presenter", permissions: ["admin"] },
    });
    const member1 = joinResult1.member;
    const peerConnection1 = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const client1 = await Client.create(
      joinResult1.offerSdp,
      member1.memberId,
      {
        peerConnection: peerConnection1,
      },
    );
    const answer1 = await client1.createAndSetAnswer();
    await member1.accept(answer1);

    // Wait for client1 connection
    await client1.onConnected.asPromise(5000);

    // Track member joined events
    let joinedMemberInfo: {
      memberId: string;
      name?: string;
      metadata?: Record<string, any>;
    } | null = null;
    client1.onMemberJoined.subscribe((memberInfo) => {
      joinedMemberInfo = memberInfo;
    });

    // Second client joins with different name and metadata
    const joinResult2 = await room.join({
      name: "Bob",
      metadata: { role: "participant", team: "engineering" },
    });
    const member2 = joinResult2.member;
    const peerConnection2 = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const client2 = await Client.create(
      joinResult2.offerSdp,
      member2.memberId,
      {
        peerConnection: peerConnection2,
      },
    );
    const answer2 = await client2.createAndSetAnswer();
    await member2.accept(answer2);

    // Wait for member joined event
    await new Promise<void>((resolve) => {
      const checkEvent = () => {
        if (joinedMemberInfo) {
          resolve();
        } else {
          setTimeout(checkEvent, 100);
        }
      };
      setTimeout(() => resolve(), 5000); // Timeout after 5 seconds
      checkEvent();
    });

    // Verify member joined event contains correct information
    expect(joinedMemberInfo).toBeTruthy();
    expect(joinedMemberInfo!.memberId).toBe(member2.memberId);
    expect(joinedMemberInfo!.name).toBe("Bob");
    expect(joinedMemberInfo!.metadata).toEqual({
      role: "participant",
      team: "engineering",
    });

    // Verify member properties are set correctly
    expect(member1.name).toBe("Alice");
    expect(member1.metadata).toEqual({
      role: "presenter",
      permissions: ["admin"],
    });
    expect(member2.name).toBe("Bob");
    expect(member2.metadata).toEqual({
      role: "participant",
      team: "engineering",
    });

    // Cleanup
    client1.close();
    client2.close();
    peerConnection1.close();
    peerConnection2.close();
  });

  it("should handle member joins without name and metadata", async () => {
    // Create room
    const room = createRoom();

    // First client joins without name/metadata
    const joinResult1 = await room.join();
    const member1 = joinResult1.member;
    const peerConnection1 = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const client1 = await Client.create(
      joinResult1.offerSdp,
      member1.memberId,
      {
        peerConnection: peerConnection1,
      },
    );
    const answer1 = await client1.createAndSetAnswer();
    await member1.accept(answer1);

    // Wait for client1 connection
    await client1.onConnected.asPromise(5000);

    // Track member joined events
    let joinedMemberInfo: {
      memberId: string;
      name?: string;
      metadata?: Record<string, any>;
    } | null = null;
    client1.onMemberJoined.subscribe((memberInfo) => {
      joinedMemberInfo = memberInfo;
    });

    // Second client joins without name/metadata
    const joinResult2 = await room.join();
    const member2 = joinResult2.member;
    const peerConnection2 = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const client2 = await Client.create(
      joinResult2.offerSdp,
      member2.memberId,
      {
        peerConnection: peerConnection2,
      },
    );
    const answer2 = await client2.createAndSetAnswer();
    await member2.accept(answer2);

    // Wait for member joined event
    await new Promise<void>((resolve) => {
      const checkEvent = () => {
        if (joinedMemberInfo) {
          resolve();
        } else {
          setTimeout(checkEvent, 100);
        }
      };
      setTimeout(() => resolve(), 5000); // Timeout after 5 seconds
      checkEvent();
    });

    // Verify member joined event contains correct information
    expect(joinedMemberInfo).toBeTruthy();
    expect(joinedMemberInfo!.memberId).toBe(member2.memberId);
    expect(joinedMemberInfo!.name).toBeUndefined();
    expect(joinedMemberInfo!.metadata).toBeUndefined();

    // Verify member properties
    expect(member1.name).toBeUndefined();
    expect(member1.metadata).toBeUndefined();
    expect(member2.name).toBeUndefined();
    expect(member2.metadata).toBeUndefined();

    // Cleanup
    client1.close();
    client2.close();
    peerConnection1.close();
    peerConnection2.close();
  });
});
