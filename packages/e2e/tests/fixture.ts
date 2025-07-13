//@ts-ignore
const { VITE_TEST_SERVER_PORT } = import.meta.env;

export const SERVER_URL = `http://localhost:${VITE_TEST_SERVER_PORT || 4001}`;
console.log(`Using server URL: ${SERVER_URL}`);

import type { Client } from "../../client/src/index.js";

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
