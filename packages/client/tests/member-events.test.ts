import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Member, type Room, createRoom } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupClient,
  cleanupClients,
  cleanupDualClient,
  createDualClientSetup,
  createTestClient,
  createTestClientWithMetadata,
  waitForConnection,
  waitForConnections,
} from "./test-utils.js";

describe("Member events", () => {
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
      const client3Setup = await createTestClient(room);

      // Wait for all clients to connect
      await waitForConnections([client, client2, client3Setup.client]);

      // Track member left events
      const leftMemberIds: string[] = [];
      client.onMemberLeft.subscribe((memberId) => {
        leftMemberIds.push(memberId);
      });

      // Get member IDs
      const secondMemberId = member2.memberId;
      const thirdMemberId = client3Setup.member.memberId;

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
      cleanupClient(client3Setup);
    });
  });

  describe("Remote members management", () => {
    it("should track remote members correctly", async () => {
      // Create room and first client with metadata
      const testRoom = createRoom();
      const client1Setup = await createTestClientWithMetadata(testRoom, {
        name: "Alice",
        metadata: { role: "presenter", permissions: ["admin"] },
      });

      await waitForConnection(client1Setup.client, 5000);

      // Initially, no remote members should be present
      expect(client1Setup.client.getRemoteMembers()).toHaveLength(0);

      // Second client joins with different name and metadata
      const client2Setup = await createTestClientWithMetadata(testRoom, {
        name: "Bob",
        metadata: { role: "participant", team: "engineering" },
      });

      await client1Setup.client.onMemberJoined.asPromise(
        5000,
        "Wait for member joined event",
      );

      // Verify remote members are tracked correctly
      const remoteMembers = client1Setup.client.getRemoteMembers();
      expect(remoteMembers).toHaveLength(1);
      expect(remoteMembers[0].id).toBe(client2Setup.member.memberId);
      expect(remoteMembers[0].name).toBe("Bob");
      expect(remoteMembers[0].metadata).toEqual({
        role: "participant",
        team: "engineering",
      });

      // Third client joins without name/metadata
      const client3Setup = await createTestClient(testRoom);

      await client1Setup.client.onMemberJoined.watch(
        (memberInfo) => memberInfo.memberId === client3Setup.member.memberId,
        5000,
        "Wait for the third member to join",
      );

      // Verify multiple remote members are tracked
      const updatedRemoteMembers = client1Setup.client.getRemoteMembers();
      expect(updatedRemoteMembers).toHaveLength(2);

      const bobMember = updatedRemoteMembers.find(
        (m) => m.id === client2Setup.member.memberId,
      );
      const thirdMember = updatedRemoteMembers.find(
        (m) => m.id === client3Setup.member.memberId,
      );

      expect(bobMember).toBeTruthy();
      expect(bobMember!.name).toBe("Bob");
      expect(bobMember!.metadata).toEqual({
        role: "participant",
        team: "engineering",
      });

      expect(thirdMember).toBeTruthy();
      expect(thirdMember!.name).toBeUndefined();
      expect(thirdMember!.metadata).toBeUndefined();

      // Test member removal
      testRoom.removeMember(client2Setup.member.memberId);
      await client1Setup.client.onMemberLeft.watch(
        (memberId) => memberId === client2Setup.member.memberId,
        5000,
      );

      // Verify member is removed from tracking
      const finalRemoteMembers = client1Setup.client.getRemoteMembers();
      expect(finalRemoteMembers).toHaveLength(1);
      expect(finalRemoteMembers[0].id).toBe(client3Setup.member.memberId);

      // Cleanup
      cleanupClients([client1Setup, client2Setup, client3Setup]);
    });

    it("should not include self in remote members list", async () => {
      const testRoom = createRoom();
      const client1Setup = await createTestClientWithMetadata(testRoom, {
        name: "Alice",
        metadata: { role: "presenter" },
      });

      await waitForConnection(client1Setup.client, 5000);

      // Self should not be in remote members list
      expect(client1Setup.client.getRemoteMembers()).toHaveLength(0);

      // Add another member
      const client2Setup = await createTestClientWithMetadata(testRoom, {
        name: "Bob",
        metadata: { role: "participant" },
      });

      await client1Setup.client.onMemberJoined.asPromise(
        5000,
        "Wait for member joined event",
      );

      // Only the other member should be in the list
      const remoteMembers = client1Setup.client.getRemoteMembers();
      expect(remoteMembers).toHaveLength(1);
      expect(remoteMembers[0].id).toBe(client2Setup.member.memberId);
      expect(remoteMembers[0].id).not.toBe(client1Setup.member.memberId); // Self should not be included

      // Cleanup
      cleanupClients([client1Setup, client2Setup]);
    });
  });
});
