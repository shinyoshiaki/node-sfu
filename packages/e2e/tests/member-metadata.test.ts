import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "../../client/src/index.js";
import {
  cleanupClients,
  createAndSetupClient,
  createRoom,
  joinRoom,
  setupClient,
} from "./fixture.js";

describe("Member Metadata and Name - Cross-client communication", () => {
  it("should broadcast member joined events with name and metadata", async () => {
    const roomId = await createRoom();

    // First client joins with name and metadata
    const { memberId: memberId1, offer: offer1 } = await joinRoom(roomId, {
      name: "Alice",
      metadata: { role: "presenter", permissions: ["admin"] },
    });

    const client1 = await setupClient(offer1, memberId1);
    await client1.onConnected.asPromise(10000);

    // Track member joined events on client1 BEFORE second client joins
    const memberJoinedPromise = client1.onMemberJoined.watch(
      (memberInfo) =>
        memberInfo.name === "Bob" &&
        memberInfo.metadata?.role === "participant",
      10000,
      "Member joined event timeout",
    );

    // Second client joins with different name and metadata
    const { memberId: memberId2, offer: offer2 } = await joinRoom(roomId, {
      name: "Bob",
      metadata: { role: "participant", team: "engineering" },
    });

    const client2 = await setupClient(offer2, memberId2);
    await client2.onConnected.asPromise(10000);

    // Wait for member joined event
    const joinedMemberInfo = await memberJoinedPromise;

    // Verify member joined event contains correct information
    expect(joinedMemberInfo).toBeTruthy();
    expect(joinedMemberInfo[0].memberId).toBe(memberId2);
    expect(joinedMemberInfo[0].name).toBe("Bob");
    expect(joinedMemberInfo[0].metadata).toEqual({
      role: "participant",
      team: "engineering",
    });

    // Cleanup
    cleanupClients([client1, client2]);
  });

  it("should handle member joins without name and metadata", async () => {
    const roomId = await createRoom();

    // First client joins without name/metadata
    const { client: client1, memberId: memberId1 } =
      await createAndSetupClient(roomId);
    await client1.onConnected.asPromise(10000);

    // Track member joined events on client1 BEFORE second client joins
    const memberJoinedPromise = client1.onMemberJoined.watch(
      (memberInfo) => memberInfo.memberId !== memberId1, // Any member other than client1
      10000,
      "Member joined event timeout",
    );

    // Second client joins without name/metadata
    const { client: client2, memberId: memberId2 } =
      await createAndSetupClient(roomId);
    await client2.onConnected.asPromise(10000);

    // Wait for member joined event
    const joinedMemberInfo = await memberJoinedPromise;

    // Verify member joined event contains correct information
    expect(joinedMemberInfo).toBeTruthy();
    expect(joinedMemberInfo[0].memberId).toBe(memberId2);
    expect(joinedMemberInfo[0].name).toBeUndefined();
    expect(joinedMemberInfo[0].metadata).toBeUndefined();

    // Cleanup
    cleanupClients([client1, client2]);
  });

  it("should return member name and metadata in join response", async () => {
    const roomId = await createRoom();

    // Join with name and metadata
    const joinResult = await joinRoom(roomId, {
      name: "TestUser",
      metadata: { role: "admin", preferences: { theme: "dark" } },
    });

    // Verify response includes name and metadata
    expect(joinResult.name).toBe("TestUser");
    expect(joinResult.metadata).toEqual({
      role: "admin",
      preferences: { theme: "dark" },
    });
    expect(joinResult.memberId).toBeDefined();
    expect(joinResult.offer).toBeDefined();
  });

  it("should handle join response without name and metadata", async () => {
    const roomId = await createRoom();

    // Join without name and metadata
    const joinResult = await joinRoom(roomId);

    // Verify response
    expect(joinResult.name).toBeUndefined();
    expect(joinResult.metadata).toBeUndefined();
    expect(joinResult.memberId).toBeDefined();
    expect(joinResult.offer).toBeDefined();
  });

  it("should track remote members using getRemoteMembers()", async () => {
    const roomId = await createRoom();

    // First client joins with name and metadata
    const { memberId: memberId1, offer: offer1 } = await joinRoom(roomId, {
      name: "Alice",
      metadata: { role: "presenter", permissions: ["admin"] },
    });

    const client1 = await setupClient(offer1, memberId1);

    // Initially, no remote members should be present
    expect(client1.getRemoteMembers()).toHaveLength(0);

    // Second client joins with different name and metadata
    const { memberId: memberId2, offer: offer2 } = await joinRoom(roomId, {
      name: "Bob",
      metadata: { role: "participant", team: "engineering" },
    });

    const client2 = await setupClient(offer2, memberId2);

    await client1.onMemberJoined.watch(
      (memberInfo) => memberInfo.memberId === memberId2,
      5000,
      "Wait for member joined event",
    );

    // Verify remote members are tracked correctly
    const remoteMembers = client1.getRemoteMembers();
    expect(remoteMembers).toHaveLength(1);
    expect(remoteMembers[0].id).toBe(memberId2);
    expect(remoteMembers[0].name).toBe("Bob");
    expect(remoteMembers[0].metadata).toEqual({
      role: "participant",
      team: "engineering",
    });

    // Third client joins without name/metadata
    const { memberId: memberId3, offer: offer3 } = await joinRoom(roomId);
    const client3 = await setupClient(offer3, memberId3);

    await client1.onMemberJoined.watch(
      (memberInfo) => memberInfo.memberId === memberId3,
      10000,
      "Wait for the third member to join",
    );

    // Verify multiple remote members are tracked
    const updatedRemoteMembers = client1.getRemoteMembers();
    expect(updatedRemoteMembers).toHaveLength(2);

    const bobMember = updatedRemoteMembers.find((m) => m.id === memberId2);
    const thirdMember = updatedRemoteMembers.find((m) => m.id === memberId3);

    expect(bobMember).toBeTruthy();
    expect(bobMember!.name).toBe("Bob");
    expect(bobMember!.metadata).toEqual({
      role: "participant",
      team: "engineering",
    });

    expect(thirdMember).toBeTruthy();
    expect(thirdMember!.name).toBeUndefined();
    expect(thirdMember!.metadata).toBeUndefined();

    // Verify self is not included in remote members
    expect(
      updatedRemoteMembers.find((m) => m.id === memberId1),
    ).toBeUndefined();

    // Cleanup
    cleanupClients([client1, client2, client3]);
  });

  it("should receive existing member information when joining a room", async () => {
    const roomId = await createRoom();

    // First client joins with name and metadata
    const { memberId: memberId1, offer: offer1 } = await joinRoom(roomId, {
      name: "Alice",
      metadata: { role: "presenter", permissions: ["admin"] },
    });

    const client1 = await setupClient(offer1, memberId1);

    // Second client joins with different name and metadata
    const { memberId: memberId2, offer: offer2 } = await joinRoom(roomId, {
      name: "Bob",
      metadata: { role: "participant", team: "engineering" },
    });

    const client2 = await setupClient(offer2, memberId2);

    // Track existing member events on client2 BEFORE completing connection
    const existingMemberPromise = client2.onMemberJoined.watch(
      (memberInfo) =>
        memberInfo.memberId === memberId1 &&
        memberInfo.name === "Alice" &&
        memberInfo.metadata?.role === "presenter",
      10000,
      "Existing member event timeout",
    );

    // Wait for existing member event
    const existingMemberInfo = await existingMemberPromise;

    // Verify existing member information was received
    expect(existingMemberInfo).toBeTruthy();
    expect(existingMemberInfo[0].memberId).toBe(memberId1);
    expect(existingMemberInfo[0].name).toBe("Alice");
    expect(existingMemberInfo[0].metadata).toEqual({
      role: "presenter",
      permissions: ["admin"],
    });

    // Cleanup
    cleanupClients([client1, client2]);
  });
});
