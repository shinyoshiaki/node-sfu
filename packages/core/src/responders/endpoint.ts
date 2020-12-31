import {
  RTCIceCandidateJSON,
  RTCSessionDescription,
} from "../../../werift/webrtc/src";
import { Room } from "../domains/room";

export class Endpoint {
  room = new Room();

  async join() {
    return this.room.join();
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescription) {
    return this.room.connection.handleAnswer(peerId, answer);
  }

  async handleCandidate(peerId: string, candidate: RTCIceCandidateJSON) {
    return this.room.connection.handleCandidate(peerId, candidate);
  }
}
