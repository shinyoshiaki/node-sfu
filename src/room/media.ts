import { RTCRtpTransceiver, RtpTrack } from "../werift";

export class Media {
  track: RtpTrack;
  peerId: string;
  rtcpId: NodeJS.Timeout;
  stopSubscribes?: { [peerId: string]: () => void } = {};

  constructor(props: Partial<Media> = {}) {
    Object.assign(this, props);
  }

  startRtcp(ssrc: number, transceiver: RTCRtpTransceiver) {
    this.rtcpId = setInterval(() => {
      try {
        transceiver.receiver.sendRtcpPLI(ssrc);
      } catch (error) {
        console.log("sendRtcpPLI", error);
        clearInterval(this.rtcpId);
      }
    }, 2000);
  }

  stopMedia() {
    clearInterval(this.rtcpId);
    Object.values(this.stopSubscribes).forEach((stop) => stop());
    return this.track.id;
  }

  subscribe(peerId: string, transceiver: RTCRtpTransceiver) {
    const { unSubscribe } = this.track.onRtp.subscribe((rtp) => {
      try {
        transceiver.sendRtp(rtp);
      } catch (error) {
        console.log("ice error", error);
      }
    });
    this.stopSubscribes[peerId] = unSubscribe;
  }

  unsubscribe(peerId: string) {
    this.stopSubscribes[peerId]();
    delete this.stopSubscribes[peerId];
  }
}
