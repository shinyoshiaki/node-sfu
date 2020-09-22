import { RTCRtpTransceiver, RtpTrack } from "../werift";
import { Media } from "./media";

type Route = {
  [mediaId: string]: Media;
};

export type TrackInfo = { mediaId: string; kind: string; publisherId: string };

export class Router {
  routes: { [publisherId: string]: Route } = {};

  get trackInfos(): TrackInfo[] {
    const medias = Object.values(this.routes)
      .map((route) => Object.values(route))
      .flatMap((v) => v);

    return medias.map((media) => ({
      mediaId: this.getMediaId(media.track),
      kind: media.track.kind,
      publisherId: media.publisherId,
    }));
  }

  addTrack(
    publisherId: string,
    track: RtpTrack,
    transceiver: RTCRtpTransceiver
  ) {
    console.log("addTrack", publisherId, track.kind);

    const mediaId = this.getMediaId(track);
    if (!this.routes[publisherId]) this.routes[publisherId] = {};
    const route = this.routes[publisherId];
    const media = (route[mediaId] = new Media({
      track,
      publisherId: publisherId,
      mediaId,
    }));

    track.onRtp.once((rtp) => {
      media.startRtcp(rtp.header.ssrc, transceiver);
    });

    return {
      mediaId: this.getMediaId(track),
      kind: track.kind,
      publisherId,
    };
  }

  removeTrack(publisherId: string, mediaId: string) {
    const media = this.routes[publisherId][mediaId];
    if (!media) return;
    const subscribers = media.stopMedia();
    delete this.routes[publisherId][mediaId];
    return subscribers;
  }

  subscribe(
    subscriberId: string,
    publisherId: string,
    trackId: string,
    transceiver: RTCRtpTransceiver
  ) {
    const media = this.routes[publisherId][trackId];
    media.subscribe(subscriberId, transceiver);
  }

  unsubscribe(subscriberId: string, publisherId: string, trackId: string) {
    const media = this.routes[publisherId][trackId];
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

  private getMediaId = (track: RtpTrack) => {
    return (track.ssrc || track.rid).toString();
  };
}
