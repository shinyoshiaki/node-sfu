import { RTCRtpTransceiver, RtpTrack } from "../../../../werift/webrtc/src";

export class Track {
  rtcpId: any;

  constructor(public track: RtpTrack, public receiver: RTCRtpTransceiver) {
    track.onRtp.once((rtp) => {
      this.startPLI(rtp.header.ssrc);
    });
  }

  private startPLI(ssrc: number) {
    this.rtcpId = setInterval(() => {
      this.receiver.receiver.sendRtcpPLI(ssrc);
    }, 2000);
  }

  stop = () => {
    clearInterval(this.rtcpId);
  };
}
