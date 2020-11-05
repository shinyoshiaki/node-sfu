import { v4 } from "uuid";
import { Worker } from "worker_threads";
import { wrap, workerThreadsWrapper } from "airpc";
import { Room } from "../../../../src";
import {
  RTCIceCandidateJSON,
  RTCSessionDescription,
} from "../../../../src/werift";

export class RoomManager {
  rooms: { [name: string]: Room } = {};

  create() {
    const name = v4();
    console.log(process.cwd(), process.env.PWD);
    const room = wrap(
      Room,
      workerThreadsWrapper(
        new Worker(`./demo/server/worker.js`, {
          workerData: { path: `./src/worker/room.worker.ts` },
        })
      )
    );
    this.rooms[name] = room as any;
    return name;
  }

  async join(name: string) {
    const room = this.rooms[name];
    return room.join();
  }

  async answer(name: string, peerId: string, answer: RTCSessionDescription) {
    const room = this.rooms[name];
    return room.handleAnswer(peerId, answer);
  }

  async candidate(
    name: string,
    peerId: string,
    candidate: RTCIceCandidateJSON
  ) {
    const room = this.rooms[name];
    return room.handleCandidate(peerId, candidate);
  }
}
