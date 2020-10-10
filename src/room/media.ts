import { RTCRtpTransceiver, RtpTrack } from "../werift";
import { Subscriber, SubscriberType } from "./subscriber";
import { Track } from "./track";

export class Media {
  tracks: Track[] = [];

  subscribers: {
    [subscriberId: string]: Subscriber;
  } = {};

  constructor(
    public mediaId: string,
    public publisherId: string,
    public kind: string
  ) {}

  addTrack(rtpTrack: RtpTrack, receiver: RTCRtpTransceiver) {
    if (this.kind !== rtpTrack.kind) throw new Error();

    const track = new Track(rtpTrack, receiver);

    this.tracks.push(track);
  }

  stop() {
    this.tracks.forEach(({ stop }) => stop());

    // todo fix below
    // Object.values(this.subscribers).forEach(({ stop }) => stop());

    return this.subscribers;
  }

  subscribe(
    subscriberId: string,
    sender: RTCRtpTransceiver,
    type: SubscriberType
  ) {
    const subscriber = (this.subscribers[subscriberId] = new Subscriber(
      sender,
      this.tracks
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
    const subscriber = this.subscribers[subscriberId];
    // todo fix below
    // subscriber.stop();
    delete this.subscribers[subscriberId];
  }
}
