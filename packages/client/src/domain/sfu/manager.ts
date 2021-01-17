import { MidPair, MediaInfo } from "../../";
import { Events } from "../../context/events";
import { Connection } from "../../responder/connection";
import { SFU } from "./sfu";

export class SFUManager {
  private sfu: { [mediaId: string]: SFU } = {};
  subscribed: MediaInfo[] = [];

  constructor(private events: Events, private connection: Connection) {}

  isSubscribed(infos: MediaInfo[]) {
    const check = !!infos.find((info) =>
      this.subscribed.find((v) => v.mediaId === info.mediaId)
    );
    return check;
  }

  subscribe(
    infos: MediaInfo[],
    pairs: MidPair[],
    datachannel?: RTCDataChannel
  ) {
    this.subscribed = [...this.subscribed, ...infos];
    infos.forEach((info) => {
      const sfu = (this.sfu[info.mediaId] = new SFU(
        this.connection,
        this.events,
        info
      ));
      if (info.kind === "application") {
        if (!datachannel) throw new Error();
        sfu.initData(datachannel);
      } else {
        const mid = pairs.find(({ mediaId }) => info.mediaId === mediaId)?.mid!;
        sfu.initAV(mid);
      }
    });
  }

  unsubscribe(info: MediaInfo) {
    const sfu = this.sfu[info.mediaId];
    this.subscribed = this.subscribed.filter((v) => v.mediaId !== info.mediaId);
    delete this.sfu[info.mediaId];
    sfu.stop();
  }

  getSFU(mediaId: string) {
    return this.sfu[mediaId];
  }
}
