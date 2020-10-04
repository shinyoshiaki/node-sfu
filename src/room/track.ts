import { RTCRtpTransceiver, RtpTrack } from "../werift";

export class Track {
  track: RtpTrack;
  publisherId: string;
  rtcpId: NodeJS.Timeout;
  trackId: string;

  subscribers: {
    [subscriberId: string]: {
      transceiver: RTCRtpTransceiver;
      stop: () => void;
    };
  } = {};

  constructor(props: Partial<Track> = {}) {
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

  stop() {
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
