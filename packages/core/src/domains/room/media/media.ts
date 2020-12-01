import { v4 } from "uuid";
import { RTCRtpTransceiver, RtpTrack } from "../../../../../werift";
import { Track } from "./track";

export class Media {
  readonly mediaId = "m_" + v4();
  readonly kind = this.transceiver.kind;
  tracks: Track[] = [];

  constructor(
    readonly publisherId: string,
    readonly transceiver: RTCRtpTransceiver
  ) {}

  addTrack(rtpTrack: RtpTrack) {
    if (this.kind !== rtpTrack.kind) throw new Error();

    const track = new Track(rtpTrack, this.transceiver);
    this.tracks.push(track);
  }

  get info(): MediaInfo {
    return {
      mediaId: this.mediaId,
      kind: this.kind,
      publisherId: this.publisherId,
    };
  }
}

export type MediaInfo = {
  mediaId: string;
  kind: string;
  publisherId: string;
};
