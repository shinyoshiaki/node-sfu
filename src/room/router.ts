import { RTCRtpTransceiver, RtpTrack } from "../werift";
import { Media } from "./media";

type Route = {
  [mediaId: string]: Media;
};

export type TrackInfo = { mediaId: string; kind: string; publisherId: string };

export class Router {
  tracks: { [publisherId: string]: Route } = {};

  get trackInfos(): TrackInfo[] {
    const medias = Object.values(this.tracks)
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
    if (!this.tracks[publisherId]) this.tracks[publisherId] = {};
    const route = this.tracks[publisherId];
    const media = (route[mediaId] = new Media({
      track,
      publisherId: publisherId,
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
    const media = this.tracks[publisherId][mediaId];
    if (!media) return;
    const subscribers = media.stopMedia();
    delete this.tracks[publisherId][mediaId];
    return subscribers;
  }

  subscribe(
    publisherId: string,
    subscriberId: string,
    trackId: string,
    transceiver: RTCRtpTransceiver
  ) {
    const media = this.tracks[publisherId][trackId];
    media.subscribe(subscriberId, transceiver);
  }

  private getMediaId = (track: RtpTrack) => {
    return (track.ssrc || track.rid).toString();
  };
}
