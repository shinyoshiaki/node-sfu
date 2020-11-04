import { RoomManager } from "./room";

export function createContext() {
  return { roomManager: new RoomManager() };
}

export type Context = ReturnType<typeof createContext>;
