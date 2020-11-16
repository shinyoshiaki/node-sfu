import debug from "debug";
import { RTCRtpTransceiver, RtpTrack } from "../../../werift";
import { Media } from "./sfu/media";
import { SubscriberType } from "./sfu/subscriber";

const log = debug("werift:sfu:router");

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

  get allMedia() {
    return Object.values(this.routes)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
  }

  get mediaInfos(): MediaInfo[] {
    return this.allMedia.map(({ mediaId, kind, publisherId }) => ({
      mediaId,
      kind,
      publisherId,
    }));
  }

  getMedia(publisherId: string, mediaId: string) {
    const media = this.routes[publisherId][mediaId];
    if (!media) throw new Error();
    return media;
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
    log("addTrack", publisherId, rtpTrack.kind, rtpTrack.rid, rtpTrack.ssrc);

    this.getMedia(publisherId, mediaId).addTrack(rtpTrack, transceiver);
  }

  removeMedia(publisherId: string, mediaId: string) {
    const subscribers = this.getMedia(publisherId, mediaId).stop();
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
    this.getMedia(publisherId, mediaId).subscribe(
      subscriberId,
      transceiver,
      type
    );
  }

  changeQuality(
    subscriberId: string,
    publisherId: string,
    mediaId: string,
    type: SubscriberType
  ) {
    this.getMedia(publisherId, mediaId).changeQuality(subscriberId, type);
  }

  unsubscribe(subscriberId: string, publisherId: string, mediaId: string) {
    this.getMedia(publisherId, mediaId).unsubscribe(subscriberId);
  }

  getSubscribed(subscriberId: string) {
    return this.allMedia.filter((media) => media.has(subscriberId));
  }
}
