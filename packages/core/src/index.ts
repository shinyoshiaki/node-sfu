import { Room } from "./room.js";

// Global room storage
const rooms = new Map<string, Room>();

// Room management functions
export function createRoom(): Room {
  const room = new Room();
  rooms.set(room.roomId, room);
  return room;
}

export function findRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

// Export classes
export { Room } from "./room.js";
export { Member } from "./member.js";
export { DataPublication } from "./dataPublication.js";
export { DataSubscription } from "./dataSubscription.js";
export { MediaPublication } from "./mediaPublication.js";
export { MediaSubscription } from "./mediaSubscription.js";

// Manager classes are now integrated into Member class
// No longer exported as they are internal implementation details
