import { RTCRtpTransceiver, RtpTrack } from "../werift";
import { Media } from "./media";
import { SubscriberType } from "./subscriber";

type Route = {
  [mediaId: string]: Media;
};

export type MediaInfo = {
  mediaId: string;
  kind: string;
  publisherId: string;
};

export class Router {
  routes: { [publisherId: string]: Route } = {};

  get mediaInfos(): MediaInfo[] {
    const medias = Object.values(this.routes)
      .map((route) => Object.values(route))
      .flatMap((v) => v);

    return medias.map(({ mediaId, kind, publisherId }) => ({
      mediaId,
      kind,
      publisherId,
    }));
  }

  addMedia(publisherId: string, mediaId: string, kind: string): MediaInfo {
    if (!this.routes[publisherId]) this.routes[publisherId] = {};
    const route = this.routes[publisherId];

    route[mediaId] = new Media(mediaId, publisherId, kind);

    return {
      mediaId,
      kind,
      publisherId,
    };
  }

  addTrack(
    publisherId: string,
    rtpTrack: RtpTrack,
    transceiver: RTCRtpTransceiver,
    mediaId: string
  ) {
    console.log("addTrack", publisherId, rtpTrack.kind);

    const media = this.routes[publisherId][mediaId];
    if (!media) throw new Error();

    media.addTrack(rtpTrack, transceiver);
  }

  removeMedia(publisherId: string, mediaId: string) {
    const media = this.routes[publisherId][mediaId];
    if (!media) throw new Error();

    const subscribers = media.stop();
    delete this.routes[publisherId][mediaId];
    return subscribers;
  }

  subscribe(
    subscriberId: string,
    publisherId: string,
    mediaId: string,
    transceiver: RTCRtpTransceiver,
    type: SubscriberType
  ) {
    const media = this.routes[publisherId][mediaId];
    media.subscribe(subscriberId, transceiver, type);
  }

  changeQuality(
    subscriberId: string,
    publisherId: string,
    mediaId: string,
    type: SubscriberType
  ) {
    const media = this.routes[publisherId][mediaId];
    media.changeQuality(subscriberId, type);
  }

  unsubscribe(subscriberId: string, publisherId: string, mediaId: string) {
    const media = this.routes[publisherId][mediaId];
    media.unsubscribe(subscriberId);
  }

  getSubscribed(subscriberId: string) {
    return this.allMedia.filter((media) => media.has(subscriberId));
  }

  private get allMedia() {
    return Object.values(this.routes)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
  }
}
