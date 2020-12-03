import { ClientSDK } from "../../../packages/client/src";
import { HttpConnection } from "./http";

export class Client extends ClientSDK {
  private readonly http = new HttpConnection({ url: this.url });
  roomName!: string;

  constructor(private url: string) {
    super();
  }

  async apiCreate() {
    this.roomName = await this.http.create();
    return this.roomName;
  }

  async apiJoin() {
    const { offer, peerId } = await this.http.join(this.roomName);
    const { answer, candidates, user } = await this.join(
      this.roomName,
      peerId,
      offer
    );
    user.onCandidate.subscribe((candidate) =>
      this.http.candidate(peerId, this.roomName, candidate)
    );
    this.http.answer(peerId, this.roomName, answer);
    candidates.forEach((candidate) =>
      this.http.candidate(peerId, this.roomName, candidate)
    );
  }
}
