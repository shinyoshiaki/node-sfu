import { RTCRtpTransceiver, RtpTrack } from "werift";

type Route = { [ssrc_or_rid: string]: { track: RtpTrack; peerId: string } };

export type TrackInfo = { id: string; kind: string; peerId: string };

export class Router {
  tracks: { [peerId: string]: Route } = {};

  get trackInfos(): TrackInfo[] {
    const flat = Object.values(this.tracks)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
    return flat.map((route) => ({
      id: this.getId(route.track),
      kind: route.track.kind,
      peerId: route.peerId,
    }));
  }

  addTrack(peerId: string, track: RtpTrack, transceiver: RTCRtpTransceiver) {
    console.log("addTrack", peerId, track.kind);
    if (!this.tracks[peerId]) this.tracks[peerId] = {};
    this.tracks[peerId][this.getId(track)] = { track, peerId };

    track.onRtp.once((rtp) => {
      console.log(rtp);
      setInterval(() => {
        transceiver.receiver.sendRtcpPLI(rtp.header.ssrc);
      }, 3000);
    });
  }

  getTrack(peerId: string, trackId: string) {
    return this.tracks[peerId][trackId];
  }

  private getId = (track: RtpTrack) => {
    return (track.ssrc || track.rid).toString();
  };
}
