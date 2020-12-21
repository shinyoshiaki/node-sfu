import { MidPair, MediaInfo } from "../../";
import { Events } from "../../context/events";
import { Connection } from "../../responder/connection";
import { SFU } from "./sfu";

export class SFUManager {
  sfu: { [mediaId: string]: SFU } = {};
  subscribed: MediaInfo[] = [];

  constructor(private events: Events, private connection: Connection) {}

  isSubscribed(infos: MediaInfo[]) {
    const check = !!infos.find((info) =>
      this.subscribed.find((v) => v.mediaId === info.mediaId)
    );
    return check;
  }

  subscribe(pairs: MidPair[], infos: MediaInfo[]) {
    this.subscribed = [...this.subscribed, ...infos];
    infos.forEach((info) => {
      const mid = pairs.find(({ mediaId }) => info.mediaId === mediaId)?.mid;
      this.sfu[info.mediaId] = new SFU(this.connection, this.events, info, mid);
    });
  }

  unsubscribe(info: MediaInfo) {
    const sfu = this.sfu[info.mediaId];
    this.subscribed = this.subscribed.filter((v) => v.mediaId !== info.mediaId);
    delete this.sfu[info.mediaId];
    sfu.stop();
  }
}
