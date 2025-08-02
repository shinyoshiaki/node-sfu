import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "../../client/src/index.js";
import {
  cleanupClients,
  createAndSetupClient,
  createRoom,
  setupMultipleClients,
  waitForConnections,
} from "./fixture.js";

describe("Member Disconnect Detection - PeerConnection close detection", () => {
  let client1: Client;
  let client2: Client;
  let roomId: string;
  let member1Id: string;
  let member2Id: string;

  beforeAll(async () => {
    roomId = await createRoom();
    const [client1Setup, client2Setup] = await setupMultipleClients(roomId, 2);

    client1 = client1Setup.client;
    member1Id = client1Setup.memberId;
    client2 = client2Setup.client;
    member2Id = client2Setup.memberId;

    await waitForConnections([client1, client2]);

    // Wait for control channels to be fully established and stable
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    cleanupClients([client1, client2]);
  });

  it("should receive onMemberLeft event when a member's PeerConnection is closed", async () => {
    // Set up member left event listeners
    const memberLeftEvents: string[] = [];

    const unsubscribe = client1.onMemberLeft.subscribe((leftMemberId) => {
      memberLeftEvents.push(leftMemberId);
    });

    try {
      // Close client2's peer connection abruptly (simulating page close or network disconnect)
      client2.close();

      // Client1 should receive onMemberLeft event for client2
      // Use longer timeout to account for disconnect detection propagation
      await client1.onMemberLeft.watch(
        (leftMemberId) => leftMemberId === member2Id,
        15000, // Increased timeout for more reliable detection
      );

      expect(memberLeftEvents).toContain(member2Id);
    } finally {
      unsubscribe.unSubscribe();
    }
  });

  it("should handle multiple members disconnecting", async () => {
    const [client3Setup, client4Setup] = await setupMultipleClients(roomId, 2);
    const client3 = client3Setup.client;
    const member3Id = client3Setup.memberId;
    const client4 = client4Setup.client;
    const member4Id = client4Setup.memberId;

    await waitForConnections([client3, client4]);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const memberLeftEvents: string[] = [];

      const unsubscribe = client1.onMemberLeft.subscribe((leftMemberId) => {
        memberLeftEvents.push(leftMemberId);
      });

      try {
        // Close both client3 and client4 simultaneously
        client3.close();
        client4.close();

        // Client1 should receive onMemberLeft events for both client3 and client4
        // Wait for both events (order may vary)
        await Promise.all([
          client1.onMemberLeft.watch(
            (leftMemberId) => leftMemberId === member3Id,
            15000,
          ),
          client1.onMemberLeft.watch(
            (leftMemberId) => leftMemberId === member4Id,
            15000,
          ),
        ]);

        expect(memberLeftEvents).toContain(member3Id);
        expect(memberLeftEvents).toContain(member4Id);
        expect(memberLeftEvents.length).toBeGreaterThanOrEqual(2);
      } finally {
        unsubscribe.unSubscribe();
      }
    } finally {
      cleanupClients([client3, client4]);
    }
  });

  it("should receive onMemberLeft event when member closes connection", async () => {
    const { client: client5, memberId: member5Id } =
      await createAndSetupClient(roomId);

    await client5.onConnected.asPromise(10000);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const memberLeftEvents: string[] = [];

      const unsubscribe = client1.onMemberLeft.subscribe((leftMemberId) => {
        memberLeftEvents.push(leftMemberId);
      });

      try {
        // Use client close instead of explicit leave API
        client5.close();

        // Wait for memberLeft event
        // Connection close triggers disconnect detection
        await client1.onMemberLeft.watch(
          (leftMemberId) => leftMemberId === member5Id,
          10000,
        );

        // Should receive the event (disconnect detection works)
        expect(memberLeftEvents).toContain(member5Id);
      } finally {
        unsubscribe.unSubscribe();
      }
    } finally {
      cleanupClients([client5]);
    }
  });
});
