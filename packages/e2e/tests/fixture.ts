//@ts-ignore
const { VITE_TEST_SERVER_PORT } = import.meta.env;

export const SERVER_URL = `http://localhost:${VITE_TEST_SERVER_PORT || 4001}`;
console.log(`Using server URL: ${SERVER_URL}`);

import { Client } from "../../client/src/index.js";

export function setupTrickleIce(client: Client, memberId: string): void {
  client.onIceCandidate.subscribe(async (candidate) => {
    try {
      const response = await fetch(
        `${SERVER_URL}/members/${memberId}/ice-candidate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidate }),
        },
      );
      if (!response.ok) {
        console.warn("Failed to send ICE candidate:", response.statusText);
      }
    } catch (error) {
      console.warn("Failed to send ICE candidate:", error);
    }
  });
}

export interface JoinRoomOptions {
  name?: string;
  metadata?: Record<string, any>;
}

export interface ClientSetup {
  client: Client;
  memberId: string;
}

export async function createRoom(): Promise<string> {
  const createResponse = await fetch(`${SERVER_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const createResult = await createResponse.json();
  return createResult.roomId;
}

export async function joinRoom(
  roomId: string,
  options?: JoinRoomOptions,
): Promise<{
  memberId: string;
  offer: any;
  name?: string;
  metadata?: Record<string, any>;
}> {
  const joinResponse = await fetch(`${SERVER_URL}/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: options ? JSON.stringify(options) : undefined,
  });
  return await joinResponse.json();
}

export async function setupClient(
  offer: any,
  memberId: string,
): Promise<Client> {
  const client = await Client.create(offer, memberId);
  setupTrickleIce(client, memberId);
  const answer = await client.createAndSetAnswer();

  await fetch(`${SERVER_URL}/members/${memberId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });

  return client;
}

export async function createAndSetupClient(
  roomId: string,
  options?: JoinRoomOptions,
): Promise<ClientSetup> {
  const { memberId, offer } = await joinRoom(roomId, options);
  const client = await setupClient(offer, memberId);
  return { client, memberId };
}

export async function setupMultipleClients(
  roomId: string,
  count: number,
  options?: JoinRoomOptions[],
): Promise<ClientSetup[]> {
  const joinPromises = Array.from({ length: count }, (_, i) =>
    joinRoom(roomId, options?.[i]),
  );
  const joinResults = await Promise.all(joinPromises);

  const clientPromises = joinResults.map(({ memberId, offer }) =>
    setupClient(offer, memberId).then((client) => ({ client, memberId })),
  );

  return await Promise.all(clientPromises);
}

export async function waitForConnections(
  clients: Client[],
  timeout = 10000,
): Promise<void> {
  await Promise.all(
    clients.map((client) => client.onConnected.asPromise(timeout)),
  );
}

export function cleanupClients(clients: Client[]): void {
  clients.forEach((client) => {
    try {
      client.close();
    } catch {
      // Ignore cleanup errors
    }
  });
}
