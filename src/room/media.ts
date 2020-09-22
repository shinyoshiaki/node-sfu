import { RTCRtpTransceiver, RtpTrack } from "../werift";

export class Media {
  track: RtpTrack;
  publisherId: string;
  rtcpId: NodeJS.Timeout;
  mediaId: string;

  subscribers: {
    [subscriberId: string]: {
      transceiver: RTCRtpTransceiver;
      stop: () => void;
    };
  } = {};

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
    Object.values(this.subscribers).forEach(({ stop }) => stop());

    return this.subscribers;
  }

  subscribe(subscriberId: string, transceiver: RTCRtpTransceiver) {
    const { unSubscribe } = this.track.onRtp.subscribe((rtp) => {
      try {
        transceiver.sendRtp(rtp);
      } catch (error) {
        console.log("ice error", error);
      }
    });
    this.subscribers[subscriberId] = { transceiver, stop: unSubscribe };
  }

  has(subscriberId: string) {
    return !!this.subscribers[subscriberId];
  }

  unsubscribe(subscriberId: string) {
    const subscriber = this.subscribers[subscriberId];
    subscriber.stop();
    delete this.subscribers[subscriberId];
  }
}
