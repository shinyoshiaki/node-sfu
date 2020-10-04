import { RTCRtpTransceiver, RtpTrack } from "../werift";
import { Track } from "./track";

type Route = {
  [trackId: string]: Track;
};

export type TrackInfo = { trackId: string; kind: string; publisherId: string };

export class Router {
  routes: { [publisherId: string]: Route } = {};

  get trackInfos(): TrackInfo[] {
    const tracks = Object.values(this.routes)
      .map((route) => Object.values(route))
      .flatMap((v) => v);

    return tracks.map((track) => ({
      trackId: this.getTrackId(track.track),
      kind: track.track.kind,
      publisherId: track.publisherId,
    }));
  }

  addTrack(
    publisherId: string,
    rtpTrack: RtpTrack,
    transceiver: RTCRtpTransceiver
  ): TrackInfo {
    console.log("addTrack", publisherId, rtpTrack.kind);

    const trackId = this.getTrackId(rtpTrack);
    if (!this.routes[publisherId]) this.routes[publisherId] = {};
    const route = this.routes[publisherId];
    const track = (route[trackId] = new Track({
      track: rtpTrack,
      publisherId: publisherId,
      trackId: trackId,
    }));

    rtpTrack.onRtp.once((rtp) => {
      track.startRtcp(rtp.header.ssrc, transceiver);
    });

    return {
      trackId: this.getTrackId(rtpTrack),
      kind: rtpTrack.kind,
      publisherId,
    };
  }

  removeTrack(publisherId: string, trackId: string) {
    const track = this.routes[publisherId][trackId];
    if (!track) return;
    const subscribers = track.stop();
    delete this.routes[publisherId][trackId];
    return subscribers;
  }

  subscribe(
    subscriberId: string,
    publisherId: string,
    trackId: string,
    transceiver: RTCRtpTransceiver
  ) {
    const track = this.routes[publisherId][trackId];
    track.subscribe(subscriberId, transceiver);
  }

  unsubscribe(subscriberId: string, publisherId: string, trackId: string) {
    const track = this.routes[publisherId][trackId];
    track.unsubscribe(subscriberId);
  }

  getSubscribed(subscriberId: string) {
    return this.allTrack.filter((track) => track.has(subscriberId));
  }

  private get allTrack() {
    return Object.values(this.routes)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
  }

  private getTrackId = (track: RtpTrack) => {
    return (track.ssrc || track.rid).toString();
  };
}
