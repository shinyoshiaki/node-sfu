import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Member, Room } from "../../core/src/index.js";
import type { Client } from "../src/index.js";
import {
  type DualClientSetup,
  cleanupDualClient,
  createAudioTrack,
  createDualClientSetup,
} from "./test-utils.js";

describe("Self-subscription error handling", () => {
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

  it("should throw error when subscribing to own data publication", async () => {
    const publication = await client.publishData();

    await expect(
      client.subscribeData(publication.publicationId),
    ).rejects.toThrow("Cannot subscribe to your own publication");
  });

  it("should throw error when subscribing to own media publication", async () => {
    const audioTrack = createAudioTrack();
    const publication = await client.publishMedia(audioTrack);

    await expect(
      client.subscribeMedia(publication.publicationId),
    ).rejects.toThrow("Cannot subscribe to your own publication");
  });

  it("should throw error for self-subscription even after unpublish and republish", async () => {
    const publication1 = await client.publishData();
    const publicationId = publication1.publicationId;

    await client.unpublishData(publicationId);

    const publication2 = await client.publishData();

    await expect(
      client.subscribeData(publication2.publicationId),
    ).rejects.toThrow("Cannot subscribe to your own publication");
  });
});
