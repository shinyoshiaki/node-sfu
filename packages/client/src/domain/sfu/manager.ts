import { MidPair, MediaInfo } from "../../";
import { Events } from "../../context/events";
import { Connection } from "../../responder/connection";
import { Consumer } from "./consumer";
import { Producer } from "./producer";

export class SFUManager {
  private consumers: { [mediaId: string]: Consumer } = {};
  private producers: { [mediaId: string]: Producer } = {};
  subscribed: MediaInfo[] = [];

  constructor(private events: Events, private connection: Connection) {}

  isSubscribed(infos: MediaInfo[]) {
    const check = !!infos.find((info) =>
      this.subscribed.find((v) => v.mediaId === info.mediaId)
    );
    return check;
  }

  publish(
    info: MediaInfo,
    { datachannel }: Partial<{ datachannel: RTCDataChannel }>
  ) {
    const producer = new Producer(info);
    if (datachannel) {
      producer.datachannel = datachannel;
    }
    this.producers[info.mediaId] = producer;
  }

  subscribe(
    infos: MediaInfo[],
    midPairs: MidPair[],
    dcPairs: {
      dc: RTCDataChannel;
      mediaId: string;
    }[]
  ) {
    this.subscribed = [...this.subscribed, ...infos];
    return infos.map((info) => {
      const consumer = (this.consumers[info.mediaId] = new Consumer(
        this.connection,
        this.events,
        info
      ));
      if (info.kind === "application") {
        const dc = dcPairs.find((v) => v.mediaId === info.mediaId)?.dc!;
        consumer.initData(dc);
      } else {
        const mid = midPairs.find(({ mediaId }) => info.mediaId === mediaId)
          ?.mid!;
        consumer.initAV(mid);
      }
      return consumer;
    });
  }

  unsubscribe(info: MediaInfo) {
    const consumer = this.consumers[info.mediaId];
    this.subscribed = this.subscribed.filter((v) => v.mediaId !== info.mediaId);
    delete this.consumers[info.mediaId];
    consumer.stop();
  }

  getConsumer(mediaId: string) {
    return this.consumers[mediaId];
  }

  getProducer(mediaId: string) {
    return this.producers[mediaId];
  }
}
