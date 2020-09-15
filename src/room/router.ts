import { RtpTrack } from "werift";

type Route = { [ssrc_or_rid: string]: RtpTrack };

export class Router {
  tracks: { [peerId: string]: Route };

  get trackIDs() {
    const flat = Object.values(this.tracks)
      .map((route) => Object.values(route))
      .flatMap((v) => v);
    return flat.map(this.getId);
  }

  addTrack(peerId: string, track: RtpTrack) {
    this.tracks[peerId][this.getId(track)] = track;
  }

  private getId = (track: RtpTrack) => {
    return track.ssrc || track.rid;
  };
}
