import { RTCRtpTransceiver, RtpTrack } from "../werift";

export class Track {
  rtcpId: NodeJS.Timeout;

  constructor(public track: RtpTrack, public receiver: RTCRtpTransceiver) {}

  startRtcp(ssrc: number) {
    this.rtcpId = setInterval(() => {
      try {
        this.receiver.receiver.sendRtcpPLI(ssrc);
      } catch (error) {
        console.log("sendRtcpPLI", error);
        clearInterval(this.rtcpId);
      }
    }, 2000);
  }

  stop = () => {
    clearInterval(this.rtcpId);
  };
}
