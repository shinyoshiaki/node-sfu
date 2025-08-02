import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createAudioTrack,
  createDualClientSetup,
} from "./test-utils.js";

describe("Client lifecycle", () => {
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

  it("should handle client close", async () => {
    const publication = await client.publishData();
    const audioTrack = createAudioTrack();
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
