import {
  MediaStreamTrack,
  RTCPeerConnection,
} from "../../../submodules/werift/packages/webrtc/src/index.js";
import { type Member, type Room, createRoom } from "../../core/src/index.js";
import { Client } from "../src/index.js";

export interface ClientTestSetup {
  room: Room;
  client: Client;
  member: Member;
  peerConnection: RTCPeerConnection;
}

export interface DualClientSetup {
  room: Room;
  client1: ClientTestSetup;
  client2: ClientTestSetup;
}

export async function createTestClient(room?: Room): Promise<ClientTestSetup> {
  const testRoom = room || createRoom();
  const joinResult = await testRoom.join();
  const member = joinResult.member;

  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const client = await Client.create(joinResult.offerSdp, member.memberId, {
    peerConnection,
  });

  const answer = await client.createAndSetAnswer();
  await member.accept(answer);

  return {
    room: testRoom,
    client,
    member,
    peerConnection,
  };
}

export async function createTestClientWithMetadata(
  room: Room,
  options?: {
    name?: string;
    metadata?: Record<string, any>;
  },
): Promise<ClientTestSetup> {
  const joinResult = await room.join(options);
  const member = joinResult.member;

  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const client = await Client.create(joinResult.offerSdp, member.memberId, {
    peerConnection,
  });

  const answer = await client.createAndSetAnswer();
  await member.accept(answer);

  return {
    room,
    client,
    member,
    peerConnection,
  };
}

export async function createDualClientSetup(): Promise<DualClientSetup> {
  const room = createRoom();
  const client1 = await createTestClient(room);
  const client2 = await createTestClient(room);

  return {
    room,
    client1,
    client2,
  };
}

export function cleanupClient(setup: ClientTestSetup): void {
  try {
    setup.client.close();
  } catch {
    // Ignore cleanup errors
  }
  try {
    setup.peerConnection.close();
  } catch {
    // Ignore cleanup errors
  }
  try {
    setup.room.removeMember(setup.member.memberId);
  } catch {
    // Ignore cleanup errors
  }
}

export function cleanupClients(setups: ClientTestSetup[]): void {
  setups.forEach((setup) => cleanupClient(setup));
}

export function cleanupDualClient(setup: DualClientSetup): void {
  cleanupClients([setup.client1, setup.client2]);
}

export function createAudioTrack(): MediaStreamTrack {
  return new MediaStreamTrack({ kind: "audio" });
}

export function createVideoTrack(): MediaStreamTrack {
  return new MediaStreamTrack({ kind: "video" });
}

export async function createClientWithCustomPeerConnection(
  room: Room,
  customPeerConnection: RTCPeerConnection,
): Promise<ClientTestSetup> {
  const joinResult = await room.join();
  const member = joinResult.member;

  const client = await Client.create(joinResult.offerSdp, member.memberId, {
    peerConnection: customPeerConnection,
  });

  const answer = await client.createAndSetAnswer();
  await member.accept(answer);

  return {
    room,
    client,
    member,
    peerConnection: customPeerConnection,
  };
}

export async function waitForConnection(
  client: Client,
  timeout = 10000,
): Promise<void> {
  await client.onConnected.asPromise(timeout);
}

export async function waitForConnections(
  clients: Client[],
  timeout = 10000,
): Promise<void> {
  await Promise.all(
    clients.map((client) => client.onConnected.asPromise(timeout)),
  );
}
