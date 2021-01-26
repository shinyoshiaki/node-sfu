import { MediaIdPair, MediaInfo } from "../../";
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
    return producer;
  }

  subscribe(
    infos: MediaInfo[],
    mediaMap: {
      [mediaId: string]: Partial<{ dc: RTCDataChannel; mid: string }>;
    }
  ) {
    this.subscribed = [...this.subscribed, ...infos];
    return infos.map((info) => {
      const consumer = (this.consumers[info.mediaId] = new Consumer(
        this.connection,
        this.events,
        info
      ));
      const { dc, mid } = mediaMap[info.mediaId];
      if (dc) {
        consumer.initData(dc);
      } else {
        consumer.initAV(mid!);
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
