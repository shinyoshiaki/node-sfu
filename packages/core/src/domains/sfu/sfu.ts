import {
  RTCPeerConnection,
  RTCRtpTransceiver,
} from "../../../../werift/webrtc/src";
import { Media } from "../media/media";
import { Subscriber, SubscriberType } from "./subscriber";

export class SFU {
  subscribers: {
    [subscriberId: string]: Subscriber;
  } = {};

  constructor(readonly media: Media, private dispose: () => void) {}

  async stop() {
    this.dispose();
    this.media.stop();

    const peers = await Promise.all(
      Object.values(this.subscribers).map(async ({ peer, sender }) => {
        if (sender) {
          peer.removeTrack(sender);
          await peer.setLocalDescription(peer.createOffer());
        }
        return peer;
      })
    );

    return peers;
  }

  subscribeAV(
    subscriberId: string,
    peer: RTCPeerConnection,
    sender?: RTCRtpTransceiver,
    type?: SubscriberType
  ) {
    const subscriber = (this.subscribers[subscriberId] = new Subscriber(
      peer,
      this.media,
      sender
    ));
    switch (type) {
      case "single":
        subscriber.listenSingle();
        break;
      case "high":
        subscriber.listenHigh();
        break;
      case "low":
        subscriber.listenLow();
        break;
      case "auto":
        subscriber.listenAuto();
        break;
    }
  }

  subscribeData(subscriberId: string, peer: RTCPeerConnection) {
    const subscriber = (this.subscribers[subscriberId] = new Subscriber(
      peer,
      this.media
    ));
    return subscriber.listenDataChannel();
  }

  unsubscribe(subscriberId: string) {
    const subscriber = this.subscribers[subscriberId];
    this.subscribers[subscriberId].unsubscribe();
    delete this.subscribers[subscriberId];
    return subscriber.sender;
  }

  changeQuality(subscriberId: string, type: SubscriberType) {
    const subscriber = this.subscribers[subscriberId];
    subscriber.changeQuality(type);
  }

  leave(subscriberId: string) {
    // todo fix
    const subscriber = this.subscribers[subscriberId];
    delete this.subscribers[subscriberId];
  }
}
