import { MediaInfo } from "../../";
import { Connection } from "../../responder/connection";
import { Events } from "../../context/events";
import Event from "rx.mini";

export class SFU {
  datachannel: RTCDataChannel;
  readonly onMessage = new Event<[any]>();
  constructor(
    private connection: Connection,
    private events: Events,
    private info: MediaInfo
  ) {}

  initAV(mid: string) {
    this.connection.ontrack.subscribe(({ transceiver, streams }) => {
      const v = transceiver.mid;
      if (mid === v) this.events.onTrack.execute(streams[0], this.info);
    });
    return this;
  }

  initData(datachannel: RTCDataChannel) {
    console.warn("initdata");
    this.events.onDataChannel.execute(datachannel);
    this.datachannel = datachannel;
    datachannel.onmessage = (ev) => {
      console.warn(ev);
      this.onMessage.execute(ev.data);
    };
    return this;
  }

  stop() {
    this.events.onUnsubscribe.execute(this.info);
  }
}
