import { MidPair, MediaInfo } from "../..";
import { Events } from "../../context/events";
import { Connection } from "../../responder/connection";
import { SFU } from "./sfu";

export class SFUManager {
  sfu: { [mediaId: string]: SFU } = {};

  constructor(private events: Events, private connection: Connection) {}

  subscribe(pairs: MidPair[], infos: MediaInfo[]) {
    infos.forEach((info) => {
      const mid = pairs.find(({ mediaId }) => info.mediaId === mediaId)?.mid;
      this.sfu[info.mediaId] = new SFU(this.connection, this.events, info, mid);
    });
  }
}
