import { RTCPeerConnection, RTCRtpTransceiver } from "../../../../../werift";
import { Media } from "../media/media";
import { Subscriber, SubscriberType } from "./subscriber";

export class SFU {
  subscribers: {
    [subscriberId: string]: Subscriber;
  } = {};

  constructor(readonly media: Media) {}

  stop() {
    this.media.tracks.forEach(({ stop }) => stop());

    const peers = Object.values(this.subscribers).map(({ peer, sender }) => {
      peer.removeTrack(sender);
      return peer;
    });
    return peers;
  }

  subscribe(
    subscriberId: string,
    peer: RTCPeerConnection,
    sender: RTCRtpTransceiver,
    type: SubscriberType
  ) {
    const subscriber = (this.subscribers[subscriberId] = new Subscriber(
      sender,
      peer,
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
}
