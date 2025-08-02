import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createDualClientSetup,
} from "./test-utils.js";

describe("Connection and client state", () => {
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
