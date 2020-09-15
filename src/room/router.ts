import { RtpTrack } from "werift";

type Route = { [ssrc_or_rid: string]: RtpTrack };

export class Router {
  tracks: { [peerId: string]: Route };

  addTrack(peerId: string, track: RtpTrack) {
    const id = track.ssrc || track.rid;
    this.tracks[peerId][id] = track;
  }
}
