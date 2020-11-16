import debug from "debug";
import { RTCRtpTransceiver, RtpTrack } from "../../../werift";
import { Media } from "./media/media";
import { SFURoutes } from "./sfu/routes";
import { SubscriberType } from "./sfu/subscriber";

const log = debug("werift:sfu:router");

export type MediaInfo = {
  mediaId: string;
  kind: string;
  publisherId: string;
};

export class Router {
  medias: { [mediaId: string]: Media } = {};
  sfuRoute = new SFURoutes();

  get allMedia() {
    return Object.values(this.medias);
  }

  get mediaInfos(): MediaInfo[] {
    return this.allMedia.map(({ mediaId, kind, publisherId }) => ({
      mediaId,
      kind,
      publisherId,
    }));
  }

  getMedia(mediaId: string) {
    const media = this.medias[mediaId];
    if (!media) throw new Error();
    return media;
  }

  addMedia(publisherId: string, mediaId: string, kind: string): MediaInfo {
    this.medias[mediaId] = new Media(mediaId, publisherId, kind);
    this.sfuRoute.addRoute(this.medias[mediaId]);

    return {
      mediaId,
      kind,
      publisherId,
    };
  }

  addTrack(
    rtpTrack: RtpTrack,
    transceiver: RTCRtpTransceiver,
    mediaId: string
  ) {
    log("addTrack", rtpTrack.kind, rtpTrack.rid, rtpTrack.ssrc);

    this.getMedia(mediaId).addTrack(rtpTrack, transceiver);
  }

  removeMedia(mediaId: string) {
    this.sfuRoute.getRoute(mediaId).stop();
    const subscribers = this.sfuRoute.getRoute(mediaId).stop();
    delete this.medias[mediaId];
    return subscribers;
  }

  subscribe(
    subscriberId: string,
    mediaId: string,
    transceiver: RTCRtpTransceiver,
    type: SubscriberType
  ) {
    this.sfuRoute.getRoute(mediaId).subscribe(subscriberId, transceiver, type);
  }

  changeQuality(subscriberId: string, mediaId: string, type: SubscriberType) {
    this.sfuRoute.getRoute(mediaId).changeQuality(subscriberId, type);
  }

  unsubscribe(subscriberId: string, mediaId: string) {
    this.sfuRoute.getRoute(mediaId).unsubscribe(subscriberId);
  }

  getSubscribed(subscriberId: string) {
    return this.allMedia.filter((media) =>
      this.sfuRoute.getRoute(media.mediaId).has(subscriberId)
    );
  }
}
