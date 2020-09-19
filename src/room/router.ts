import { RTCRtpTransceiver, RtpTrack } from "werift";

type Route = { [mediaId: string]: { track: RtpTrack; peerId: string } };

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
    if (!this.tracks[peerId]) this.tracks[peerId] = {};
    this.tracks[peerId][this.getMediaId(track)] = { track, peerId };

    track.onRtp.once((rtp) => {
      const id = setInterval(() => {
        try {
          transceiver.receiver.sendRtcpPLI(rtp.header.ssrc);
        } catch (error) {
          console.log("sendRtcpPLI", error);
          clearInterval(id);
        }
      }, 3000);
    });

    return {
      mediaId: this.getMediaId(track),
      kind: track.kind,
      peerId: peerId,
    };
  }

  getTrack(peerId: string, trackId: string) {
    return this.tracks[peerId][trackId];
  }

  private getMediaId = (track: RtpTrack) => {
    return (track.ssrc || track.rid).toString();
  };
}
