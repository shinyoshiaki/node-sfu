import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RTCPeerConnection } from "../../../submodules/werift/packages/webrtc/src/index.js";
import { type Room, createRoom } from "../../core/src/index.js";
import {
  type ClientTestSetup,
  cleanupClient,
  createClientWithCustomPeerConnection,
} from "./test-utils.js";

describe("Client configuration", () => {
  let room: Room;

  beforeEach(() => {
    room = createRoom();
  });

  it("should support custom peer connection injection", async () => {
    const customPeerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.custom.com:19302" }],
    });

    const customSetup = await createClientWithCustomPeerConnection(
      room,
      customPeerConnection,
    );

    expect(customSetup.client.peerConnection).toBe(customPeerConnection);

    // Cleanup
    cleanupClient(customSetup);
  });

  it("should support custom ICE servers", async () => {
    const customIceServers = [{ urls: "stun:stun.custom.com:19302" }];
    const customPeerConnection = new RTCPeerConnection({
      iceServers: customIceServers,
    });

    const customSetup = await createClientWithCustomPeerConnection(
      room,
      customPeerConnection,
    );

    const config = customSetup.client.peerConnection.getConfiguration();
    expect(config.iceServers).toEqual(customIceServers);

    // Cleanup
    cleanupClient(customSetup);
  });
});
