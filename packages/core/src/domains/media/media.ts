import { RTCRtpTransceiver, RtpTrack } from "../../../../werift";
import { Track } from "./track";

export class Media {
  tracks: Track[] = [];

  constructor(
    public mediaId: string,
    public publisherId: string,
    public kind: string
  ) {}

  addTrack(rtpTrack: RtpTrack, receiver: RTCRtpTransceiver) {
    if (this.kind !== rtpTrack.kind) throw new Error();

    const track = new Track(rtpTrack, receiver);

    this.tracks.push(track);
  }
}
