import { RTCRtpTransceiver, RtpTrack } from "werift";

type Route = { [ssrc_or_rid: string]: RtpTrack };

export type TrackInfo = { id: string };

export class Router {
  tracks: { [peerId: string]: Route } = {};

  get trackInfos(): TrackInfo[] {
    const flat = Object.values(this.tracks)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
    return flat.map((t) => ({ id: this.getId(t) }));
  }

  addTrack(peerId: string, track: RtpTrack, transceiver: RTCRtpTransceiver) {
    console.log("addTrack", peerId, track.kind);
    if (!this.tracks[peerId]) this.tracks[peerId] = {};
    this.tracks[peerId][this.getId(track)] = track;

    track.onRtp.once((rtp) => {
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
