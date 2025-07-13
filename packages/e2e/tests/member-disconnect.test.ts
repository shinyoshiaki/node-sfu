import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "../../client/src/index.js";
import { SERVER_URL, setupTrickleIce } from "./fixture.js";

describe("Member Disconnect Detection - PeerConnection close detection", () => {
  let client1: Client;
  let client2: Client;
  let roomId: string;
  let member1Id: string;
  let member2Id: string;

  beforeAll(async () => {
    // Create a room
    const createResponse = await fetch(`${SERVER_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const createResult = await createResponse.json();
    roomId = createResult.roomId;

    // Join the room with first client
    const client1JoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const client1JoinResult = await client1JoinResponse.json();
    member1Id = client1JoinResult.memberId;
    const client1Offer = client1JoinResult.offer;

    // Create first client
    client1 = await Client.create(client1Offer, member1Id);
    setupTrickleIce(client1, member1Id);
    const client1Answer = await client1.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${member1Id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: client1Answer }),
    });

    // Join the room with second client
    const client2JoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const client2JoinResult = await client2JoinResponse.json();
    member2Id = client2JoinResult.memberId;
    const client2Offer = client2JoinResult.offer;

    // Create second client
    client2 = await Client.create(client2Offer, member2Id);
    setupTrickleIce(client2, member2Id);
    const client2Answer = await client2.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${member2Id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: client2Answer }),
    });

    // Wait for both clients to connect
    await Promise.all([
      client1.onConnected.asPromise(10000),
      client2.onConnected.asPromise(10000),
    ]);

    // Wait for control channels to be fully established and stable
    // This ensures disconnect detection will work reliably
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (member1Id) {
      try {
        await fetch(`${SERVER_URL}/members/${member1Id}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // Ignore if member already disconnected
      }
    }
    if (member2Id) {
      try {
        await fetch(`${SERVER_URL}/members/${member2Id}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // Ignore if member already disconnected
      }
    }
    if (client1) {
      client1.close();
    }
    if (client2) {
      client2.close();
    }
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
    // Create third and fourth members
    const client3JoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const client3JoinResult = await client3JoinResponse.json();
    const member3Id = client3JoinResult.memberId;
    const client3Offer = client3JoinResult.offer;

    const client4JoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const client4JoinResult = await client4JoinResponse.json();
    const member4Id = client4JoinResult.memberId;
    const client4Offer = client4JoinResult.offer;

    const client3 = await Client.create(client3Offer, member3Id);
    setupTrickleIce(client3, member3Id);
    const client3Answer = await client3.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${member3Id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: client3Answer }),
    });

    const client4 = await Client.create(client4Offer, member4Id);
    setupTrickleIce(client4, member4Id);
    const client4Answer = await client4.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${member4Id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: client4Answer }),
    });

    await Promise.all([
      client3.onConnected.asPromise(10000),
      client4.onConnected.asPromise(10000),
    ]);
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
      // Cleanup in case test fails
      try {
        client3.close();
      } catch {
        // Ignore if already closed
      }
      try {
        client4.close();
      } catch {
        // Ignore if already closed
      }
    }
  });

  it("should receive onMemberLeft event for explicitly leaving members", async () => {
    // Create a fifth member for explicit leave testing
    const client5JoinResponse = await fetch(
      `${SERVER_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const client5JoinResult = await client5JoinResponse.json();
    const member5Id = client5JoinResult.memberId;
    const client5Offer = client5JoinResult.offer;

    const client5 = await Client.create(client5Offer, member5Id);
    setupTrickleIce(client5, member5Id);
    const client5Answer = await client5.createAndSetAnswer();
    await fetch(`${SERVER_URL}/members/${member5Id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: client5Answer }),
    });

    await client5.onConnected.asPromise(10000);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const memberLeftEvents: string[] = [];

      const unsubscribe = client1.onMemberLeft.subscribe((leftMemberId) => {
        memberLeftEvents.push(leftMemberId);
      });

      try {
        // Use explicit leave API instead of closing PeerConnection
        await fetch(`${SERVER_URL}/members/${member5Id}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        // Wait for memberLeft event
        // Explicit leave should be faster than disconnect detection
        await client1.onMemberLeft.watch(
          (leftMemberId) => leftMemberId === member5Id,
          10000,
        );

        // Should receive the event (both explicit leave and disconnect detection work)
        expect(memberLeftEvents).toContain(member5Id);
      } finally {
        unsubscribe.unSubscribe();
      }
    } finally {
      // Cleanup
      try {
        client5.close();
      } catch {
        // Ignore if already closed
      }
    }
  });
});
