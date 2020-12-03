import { MediaInfo } from "../../../lib";
import { Events } from "../../context/events";
import { Connection } from "../../responder/connection";

export class MCU {
  infos: { [mediaId: string]: MediaInfo } = {};

  constructor(
    private connection: Connection,
    private events: Events,
    readonly id: string,
    private mid: string
  ) {
    this.listen();
  }

  private listen() {
    this.connection.ontrack.subscribe(({ transceiver, streams }) => {
      const mid = transceiver.mid;
      if (this.mid === mid) this.events.onTrack.execute(streams[0], this.info);
    });
  }

  get info(): MediaInfo {
    return { mediaId: "mixer", kind: "mixer", publisherId: "server" };
  }

  add(info: MediaInfo) {
    this.infos[info.mediaId] = info;
  }

  remove(info: MediaInfo) {
    delete this.infos[info.mediaId];
  }
}
