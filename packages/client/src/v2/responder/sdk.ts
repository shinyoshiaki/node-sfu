import { subscribe } from "../actions/sfu";
import { join, publish } from "../actions/user";
import { User } from "../domain/user";
import { Connection } from "./connection";
import { MediaInfo } from "../../";
import { SFUManager } from "../domain/sfu/manager";
import { Events } from "../../context/events";

export class ClientSDK {
  events = new Events();
  connection = new Connection(this.events);
  sfu = new SFUManager(this.events, this.connection);
  user: User;
  peerId!: string;

  async join(roomName: string, peerId: string, offer: RTCSessionDescription) {
    const { answer, user, candidates } = await join(this.connection)(
      roomName,
      peerId,
      offer
    );
    this.user = user;
    this.peerId = peerId;
    return { answer, candidates, user };
  }

  async publish(requests: { track: MediaStreamTrack; simulcast?: boolean }[]) {
    await publish(this.connection, this.user)(requests);
  }

  async subscribe(infos: MediaInfo[]) {
    subscribe(this.connection, this.sfu)(infos);
  }

  async getMedias() {
    return this.connection.getMedias();
  }
}
