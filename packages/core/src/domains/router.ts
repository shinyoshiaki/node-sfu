import debug from "debug";
import { RTCRtpTransceiver, RtpTrack } from "../../../werift";
import { MCUManager } from "./mcu/manager";
import { Media } from "./media/media";
import { SFUManager } from "./sfu/manager";
import { SubscriberType } from "./sfu/subscriber";

const log = debug("werift:sfu:router");

export class Router {
  medias: { [mediaId: string]: Media } = {};
  sfu = new SFUManager();
  mcu = new MCUManager();

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
    this.sfu.addRoute(this.medias[mediaId]);

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
    this.sfu.getRoute(mediaId).stop();
    const subscribers = this.sfu.getRoute(mediaId).stop();
    delete this.medias[mediaId];
    return subscribers;
  }

  subscribe(
    subscriberId: string,
    mediaId: string,
    transceiver: RTCRtpTransceiver,
    type: SubscriberType
  ) {
    this.sfu.getRoute(mediaId).subscribe(subscriberId, transceiver, type);
  }

  listenMixedAudio(mediaIds: string[], transceiver: RTCRtpTransceiver) {
    const medias = mediaIds.map((id) => this.medias[id]);
    return this.mcu.subscribe(medias, transceiver);
  }

  changeQuality(subscriberId: string, mediaId: string, type: SubscriberType) {
    this.sfu.getRoute(mediaId).changeQuality(subscriberId, type);
  }

  unsubscribe(subscriberId: string, mediaId: string) {
    this.sfu.getRoute(mediaId).unsubscribe(subscriberId);
  }

  getSubscribed(subscriberId: string) {
    return this.allMedia.filter((media) =>
      this.sfu.getRoute(media.mediaId).has(subscriberId)
    );
  }
}

export type MediaInfo = {
  mediaId: string;
  kind: string;
  publisherId: string;
};
