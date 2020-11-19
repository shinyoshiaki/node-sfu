import { RTCRtpTransceiver } from "../../../../werift";
import { Subscriber, SubscriberType } from "./subscriber";
import { Media } from "../media/media";

export class SFURouter {
  subscribers: {
    [subscriberId: string]: Subscriber;
  } = {};

  constructor(public media: Media) {}

  stop() {
    this.media.tracks.forEach(({ stop }) => stop());

    return this.subscribers;
  }

  subscribe(
    subscriberId: string,
    sender: RTCRtpTransceiver,
    type: SubscriberType
  ) {
    const subscriber = (this.subscribers[subscriberId] = new Subscriber(
      sender,
      this.media.tracks
    ));
    switch (type) {
      case "single":
        subscriber.single();
        break;
      case "high":
        subscriber.high();
        break;
      case "low":
        subscriber.low();
        break;
      case "auto":
        subscriber.auto();
        break;
    }
  }

  changeQuality(subscriberId: string, type: SubscriberType) {
    const subscriber = this.subscribers[subscriberId];
    subscriber.changeQuality(type);
  }

  has(subscriberId: string) {
    return !!this.subscribers[subscriberId];
  }

  unsubscribe(subscriberId: string) {
    delete this.subscribers[subscriberId];
  }
}
