import { v4 } from "uuid";
import { Room } from "../../../../packages/core/src";
import {
  RTCIceCandidateJSON,
  RTCSessionDescription,
} from "../../../../packages/werift/webrtc/src";

const workerPath = process.argv[3];
const workerLoaderPath =
  process.argv[2] === "prod" ? workerPath : process.argv[2];

export class RoomManager {
  rooms: { [name: string]: Room } = {};

  create(name = v4()) {
    console.log(process.cwd(), process.env.PWD);

    // const room = wrap(
    //   Room,
    //   workerThreadsWrapper(
    //     new Worker(workerLoaderPath, {
    //       workerData: { path: workerPath },
    //     })
    //   )
    // );
    const room = new Room();
    this.rooms[name] = room as any;
    return name;
  }

  async join(name: string) {
    if (!this.rooms[name]) {
      this.create(name);
    }
    const room = this.rooms[name];

    return room.join();
  }

  async answer(name: string, peerId: string, answer: RTCSessionDescription) {
    const room = this.rooms[name];
    return room.connection.handleAnswer(peerId, answer);
  }

  async candidate(
    name: string,
    peerId: string,
    candidate: RTCIceCandidateJSON
  ) {
    const room = this.rooms[name];
    return room.connection.handleCandidate(peerId, candidate);
  }
}
