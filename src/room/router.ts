import { RTCRtpTransceiver, RtpTrack } from "werift";
import { Media } from "./media";

type Route = {
  [mediaId: string]: Media;
};

export type TrackInfo = { mediaId: string; kind: string; peerId: string };

export class Router {
  tracks: { [peerId: string]: Route } = {};

  get trackInfos(): TrackInfo[] {
    const flat = Object.values(this.tracks)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
    return flat.map((route) => ({
      mediaId: this.getMediaId(route.track),
      kind: route.track.kind,
      peerId: route.peerId,
    }));
  }

  addTrack(peerId: string, track: RtpTrack, transceiver: RTCRtpTransceiver) {
    console.log("addTrack", peerId, track.kind);
    const mediaId = this.getMediaId(track);
    if (!this.tracks[peerId]) this.tracks[peerId] = {};
    const route = this.tracks[peerId];
    const media = (route[mediaId] = new Media({ track, peerId }));

    track.onRtp.once((rtp) => {
      media.startRtcp(rtp.header.ssrc, transceiver);
    });

    return {
      mediaId: this.getMediaId(track),
      kind: track.kind,
      peerId: peerId,
    };
  }

  removeTrack(peerId: string, mediaId: string) {
    const media = this.tracks[peerId][mediaId];
    if (!media) return;
    media.stopMedia();
    delete this.tracks[peerId][mediaId];
  }

  getTrack(peerId: string, trackId: string) {
    return this.tracks[peerId][trackId];
  }

  private getMediaId = (track: RtpTrack) => {
    return (track.ssrc || track.rid).toString();
  };
}
