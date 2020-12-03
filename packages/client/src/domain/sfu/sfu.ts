import { MediaInfo } from "../../";
import { Connection } from "../../responder/connection";
import { Events } from "../../context/events";

export class SFU {
  constructor(
    private connection: Connection,
    private events: Events,
    private info: MediaInfo,
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
}
